"""Paid Premium from three sources, all ending in users.premium_until:

- Google Play: the app buys; we read the purchase from the Play Developer API
  (never trusting the app's word) and acknowledge it. Google then tells us of
  every change (renewal, grace period, hold, cancel...) through Pub/Sub (RTDN),
  and we read the subscription again each time.
- App Store: the app sends the signed transaction (JWS); Apple's later changes
  come as App Store Server Notifications (also signed). We check the signature
  chain up to Apple's root certificate.
- Paddle (web): Paddle sells and handles taxes; its signed webhooks report the
  subscription's state.

Google and Apple retry failed renewals themselves (grace period, then hold);
Paddle runs its own dunning. We only mirror the state.
"""
import base64
import hashlib
import hmac
import json
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from datetime import datetime, timedelta, timezone

import jwt
from cryptography import x509
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import ec
from sqlalchemy.orm import Session

from config import settings
from models.subscription import Subscription
from models.user import User

LIVE = ("active", "grace", "canceled")  # still Premium until expires_at
ISSUE = ("grace", "on_hold")  # a payment failed: tell the user
PADDLE_GRACE = timedelta(days=7)  # past_due: Premium kept while Paddle retries


class BillingError(Exception):
    pass


def _http(method: str, url: str, body: bytes | None = None, headers: dict | None = None) -> dict:
    request = urllib.request.Request(url, data=body, method=method, headers=headers or {})
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            text = response.read().decode()
            return json.loads(text) if text else {}
    except urllib.error.HTTPError as exc:
        raise BillingError(f"{url} -> {exc.code}: {exc.read().decode()[:300]}") from exc
    except (urllib.error.URLError, TimeoutError) as exc:
        raise BillingError(f"{url} -> {exc}") from exc


def parse_time(value) -> datetime | None:
    if value is None or value == "":
        return None
    if isinstance(value, (int, float)):  # Apple: ms since epoch
        return datetime.fromtimestamp(value / 1000, tz=timezone.utc)
    return datetime.fromisoformat(str(value).replace("Z", "+00:00"))


# ---- Google Play ----

_google_token: dict = {"value": None, "exp": 0.0}


def google_configured() -> bool:
    return bool(settings.GOOGLE_SERVICE_ACCOUNT_JSON)


def _google_access_token() -> str:
    if _google_token["value"] and _google_token["exp"] > time.time() + 60:
        return _google_token["value"]
    account = json.loads(settings.GOOGLE_SERVICE_ACCOUNT_JSON)
    now = int(time.time())
    assertion = jwt.encode(
        {
            "iss": account["client_email"],
            "scope": "https://www.googleapis.com/auth/androidpublisher",
            "aud": "https://oauth2.googleapis.com/token",
            "iat": now,
            "exp": now + 3600,
        },
        account["private_key"],
        algorithm="RS256",
    )
    data = _http(
        "POST",
        "https://oauth2.googleapis.com/token",
        urllib.parse.urlencode(
            {"grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer", "assertion": assertion}
        ).encode(),
        {"Content-Type": "application/x-www-form-urlencoded"},
    )
    _google_token.update(value=data["access_token"], exp=now + int(data.get("expires_in", 3600)))
    return data["access_token"]


def _google_api(method: str, path: str) -> dict:
    base = f"https://androidpublisher.googleapis.com/androidpublisher/v3/applications/{settings.GOOGLE_PLAY_PACKAGE}"
    return _http(
        method,
        base + path,
        b"{}" if method == "POST" else None,
        {"Authorization": f"Bearer {_google_access_token()}", "Content-Type": "application/json"},
    )


def google_subscription(token: str) -> dict:
    return _google_api("GET", f"/purchases/subscriptionsv2/tokens/{urllib.parse.quote(token, safe='')}")


def google_acknowledge(product_id: str, token: str) -> None:
    # Unacknowledged purchases are refunded by Google after 3 days.
    _google_api(
        "POST",
        f"/purchases/subscriptions/{urllib.parse.quote(product_id, safe='')}/tokens/{urllib.parse.quote(token, safe='')}:acknowledge",
    )


GOOGLE_STATES = {
    "SUBSCRIPTION_STATE_ACTIVE": "active",
    "SUBSCRIPTION_STATE_IN_GRACE_PERIOD": "grace",
    "SUBSCRIPTION_STATE_CANCELED": "canceled",  # won't renew; paid up until expiry
    "SUBSCRIPTION_STATE_ON_HOLD": "on_hold",
    "SUBSCRIPTION_STATE_PAUSED": "paused",
    "SUBSCRIPTION_STATE_PENDING": "pending",
    "SUBSCRIPTION_STATE_EXPIRED": "expired",
    "SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED": "expired",
}


def from_google(data: dict) -> dict:
    items = data.get("lineItems") or [{}]
    expiries = [parse_time(i.get("expiryTime")) for i in items if i.get("expiryTime")]
    return {
        "status": GOOGLE_STATES.get(data.get("subscriptionState", ""), "expired"),
        "expires_at": max(expiries) if expiries else None,
        "product_id": items[0].get("productId"),
        "account": (data.get("externalAccountIdentifiers") or {}).get("obfuscatedExternalAccountId"),
        "linked_token": data.get("linkedPurchaseToken"),
        "acknowledged": data.get("acknowledgementState") == "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED",
    }


# ---- App Store ----

# SHA-256 of "Apple Root CA - G3", the root every App Store signature chains to.
APPLE_ROOT_G3_SHA256 = "63343abfb89a6a03ebb57e9b3f5fa7be7c4f5c756f3017b3a8c488c3653e9179"
_APPLE_LEAF_OID = x509.ObjectIdentifier("1.2.840.113635.100.6.11.1")
_APPLE_INTERMEDIATE_OID = x509.ObjectIdentifier("1.2.840.113635.100.6.2.1")


def apple_decode(jws: str) -> dict:
    """Payload of an App Store signed JWS, after checking its x5c chain
    (leaf ← Apple intermediate ← Apple Root CA G3) and the signature."""
    try:
        header = jwt.get_unverified_header(jws)
        chain = [x509.load_der_x509_certificate(base64.b64decode(c)) for c in header.get("x5c", [])]
        if len(chain) != 3:
            raise BillingError("unexpected certificate chain")
        leaf, intermediate, root = chain
        if root.fingerprint(hashes.SHA256()).hex() != APPLE_ROOT_G3_SHA256:
            raise BillingError("not Apple's root certificate")
        now = datetime.now(timezone.utc)
        for child, parent in ((leaf, intermediate), (intermediate, root)):
            parent.public_key().verify(
                child.signature, child.tbs_certificate_bytes, ec.ECDSA(child.signature_hash_algorithm)
            )
            if not child.not_valid_before_utc <= now <= child.not_valid_after_utc:
                raise BillingError("certificate expired")
        leaf.extensions.get_extension_for_oid(_APPLE_LEAF_OID)
        intermediate.extensions.get_extension_for_oid(_APPLE_INTERMEDIATE_OID)
        return jwt.decode(jws, leaf.public_key(), algorithms=["ES256"])
    except BillingError:
        raise
    except Exception as exc:  # malformed input, bad signature, missing extension
        raise BillingError(f"invalid App Store signature: {exc}") from exc


def from_apple(tx: dict, renewal: dict | None = None, notification: str | None = None, subtype: str | None = None) -> dict:
    expires = parse_time(tx.get("expiresDate"))
    if tx.get("revocationDate") or notification in ("EXPIRED", "GRACE_PERIOD_EXPIRED", "REFUND", "REVOKE"):
        status = "expired"
    elif notification == "DID_FAIL_TO_RENEW":
        if subtype == "GRACE_PERIOD" and renewal and renewal.get("gracePeriodExpiresDate"):
            status, expires = "grace", parse_time(renewal["gracePeriodExpiresDate"])
        else:
            status = "on_hold"  # Apple keeps retrying, no access meanwhile
    elif expires and expires <= datetime.now(timezone.utc):
        status = "expired"
    elif renewal is not None and renewal.get("autoRenewStatus") == 0:
        status = "canceled"
    else:
        status = "active"
    return {
        "status": status,
        "expires_at": expires,
        "product_id": tx.get("productId"),
        "account": tx.get("appAccountToken"),
        "external_id": str(tx.get("originalTransactionId") or tx.get("transactionId")),
        "bundle_id": tx.get("bundleId"),
    }


# ---- Paddle ----


def paddle_signature_ok(header: str, body: bytes, secret: str, now: float | None = None, tolerance: int = 300) -> bool:
    """Paddle-Signature: "ts=...;h1=..." (h1 may repeat while a secret rotates)."""
    ts, signatures = None, []
    for part in (header or "").split(";"):
        key, _, value = part.partition("=")
        if key == "ts":
            ts = value
        elif key == "h1":
            signatures.append(value)
    if not secret or not ts or not ts.isdigit() or not signatures:
        return False
    if abs((now if now is not None else time.time()) - int(ts)) > tolerance:
        return False
    expected = hmac.new(secret.encode(), ts.encode() + b":" + body, hashlib.sha256).hexdigest()
    return any(hmac.compare_digest(expected, s) for s in signatures)


def from_paddle(sub: dict) -> dict:
    period_end = parse_time((sub.get("current_billing_period") or {}).get("ends_at"))
    status = sub.get("status")
    if status in ("active", "trialing"):
        cancelling = (sub.get("scheduled_change") or {}).get("action") == "cancel"
        state, expires = ("canceled" if cancelling else "active"), period_end
    elif status == "past_due":
        state, expires = "grace", (period_end or datetime.now(timezone.utc)) + PADDLE_GRACE
    else:  # canceled, paused
        state, expires = "expired", None
    items = sub.get("items") or [{}]
    return {
        "status": state,
        "expires_at": expires,
        "product_id": (items[0].get("price") or {}).get("id"),
        "account": (sub.get("custom_data") or {}).get("user_id"),
        "external_id": sub.get("id"),
    }


def paddle_portal_url(customer_id: str, subscription_id: str) -> str:
    base = "https://sandbox-api.paddle.com" if settings.PADDLE_SANDBOX else "https://api.paddle.com"
    data = _http(
        "POST",
        f"{base}/customers/{urllib.parse.quote(customer_id, safe='')}/portal-sessions",
        json.dumps({"subscription_ids": [subscription_id]}).encode(),
        {"Authorization": f"Bearer {settings.PADDLE_API_KEY}", "Content-Type": "application/json"},
    )
    return data["data"]["urls"]["general"]["overview"]


# ---- Saving ----


def user_by_id(db: Session, account: str | None) -> User | None:
    try:
        return db.get(User, uuid.UUID(str(account))) if account else None
    except ValueError:  # not a uuid: not one of ours
        return None


def owner_conflict(db: Session, user: User, account: str | None) -> bool:
    """The store says this purchase belongs to another (still existing) account."""
    return bool(account) and account != str(user.id) and user_by_id(db, account) is not None


def save(db: Session, user_id, source: str, external_id: str, state: dict, raw: dict | None, event_at: datetime | None = None) -> Subscription:
    sub = db.query(Subscription).filter_by(source=source, external_id=external_id).first()
    if sub is None:
        sub = Subscription(user_id=user_id, source=source, external_id=external_id)
        db.add(sub)
    elif event_at and sub.event_at and event_at < sub.event_at:
        return sub  # an older report arriving late
    sub.status = state["status"]
    sub.expires_at = state["expires_at"]
    sub.product_id = state.get("product_id") or sub.product_id
    sub.event_at = event_at or datetime.now(timezone.utc)
    sub.raw = raw
    db.flush()
    recompute(db, db.get(User, sub.user_id))
    return sub


def recompute(db: Session, user: User | None) -> None:
    """premium_until = the furthest paid-up subscription; the source it's from;
    and whether a payment is failing right now."""
    if user is None:
        return
    subs = db.query(Subscription).filter_by(user_id=user.id).all()
    if not subs:
        return  # nothing bought: leave premium_until (e.g. set by hand) alone
    now = datetime.now(timezone.utc)
    live = [s for s in subs if s.status in LIVE and s.expires_at and s.expires_at > now]
    best = max(live, key=lambda s: s.expires_at) if live else None
    user.premium_until = best.expires_at if best else None
    user.premium_source = best.source if best else None
    issues = sorted((s for s in subs if s.status in ISSUE), key=lambda s: s.updated_at or now, reverse=True)
    user.billing_issue = issues[0].source if issues and not (best and best.status == "active") else None
