"""Self-check for billing.py (signatures and state mapping). Run: python test_billing.py"""
import base64
import hashlib
import hmac
import os
from datetime import datetime, timedelta, timezone

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg2://x:x@localhost/x")
os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")

import jwt
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.x509.oid import NameOID

import billing

now = datetime.now(timezone.utc)

# ---- Paddle signature ----
body, secret, ts = b'{"x":1}', "pdl_secret", "1700000000"
good = hmac.new(secret.encode(), ts.encode() + b":" + body, hashlib.sha256).hexdigest()
assert billing.paddle_signature_ok(f"ts={ts};h1={good}", body, secret, now=1700000010)
assert billing.paddle_signature_ok(f"ts={ts};h1=old;h1={good}", body, secret, now=1700000010), "rotating secrets"
assert not billing.paddle_signature_ok(f"ts={ts};h1={good}", b'{"x":2}', secret, now=1700000010), "tampered body"
assert not billing.paddle_signature_ok(f"ts={ts};h1={good}", body, secret, now=1700009999), "replayed later"
assert not billing.paddle_signature_ok(f"ts={ts};h1={good}", body, "", now=1700000010), "no secret configured"

# ---- State mapping ----
g = billing.from_google({
    "subscriptionState": "SUBSCRIPTION_STATE_IN_GRACE_PERIOD",
    "lineItems": [{"productId": "fitrack_premium_yearly", "expiryTime": "2026-11-01T10:00:00.123Z"}],
    "externalAccountIdentifiers": {"obfuscatedExternalAccountId": "u1"},
    "acknowledgementState": "ACKNOWLEDGEMENT_STATE_PENDING",
})
assert g["status"] == "grace" and g["account"] == "u1" and not g["acknowledged"]
assert g["expires_at"] == datetime(2026, 11, 1, 10, 0, 0, 123000, tzinfo=timezone.utc)

end = (now + timedelta(days=20)).isoformat()
p = billing.from_paddle({"id": "sub_1", "status": "active", "current_billing_period": {"ends_at": end},
                         "scheduled_change": {"action": "cancel"}, "custom_data": {"user_id": "u2"}})
assert p["status"] == "canceled" and p["account"] == "u2", "cancelled at period end: paid up until then"
assert billing.from_paddle({"id": "s", "status": "past_due", "current_billing_period": {"ends_at": end}})["status"] == "grace"
assert billing.from_paddle({"id": "s", "status": "canceled"})["expires_at"] is None

ms = lambda d: int(d.timestamp() * 1000)
tx = {"originalTransactionId": 7, "productId": "p", "expiresDate": ms(now + timedelta(days=30)), "bundleId": "b"}
assert billing.from_apple(tx)["status"] == "active"
assert billing.from_apple(tx, {"autoRenewStatus": 0})["status"] == "canceled"
assert billing.from_apple({**tx, "revocationDate": 1})["status"] == "expired", "refunded"
grace = billing.from_apple(tx, {"gracePeriodExpiresDate": ms(now + timedelta(days=3))}, "DID_FAIL_TO_RENEW", "GRACE_PERIOD")
assert grace["status"] == "grace" and grace["external_id"] == "7"
assert billing.from_apple(tx, None, "DID_FAIL_TO_RENEW")["status"] == "on_hold"

# ---- App Store signature chain (a fake chain built here) ----


def cert(subject, issuer_key, key, issuer=None, oid=None, ca=True):
    name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, subject)])
    b = (x509.CertificateBuilder().subject_name(name).issuer_name(issuer or name)
         .public_key(key.public_key()).serial_number(x509.random_serial_number())
         .not_valid_before(now - timedelta(days=1)).not_valid_after(now + timedelta(days=365))
         .add_extension(x509.BasicConstraints(ca=ca, path_length=None), critical=True))
    if oid:
        b = b.add_extension(x509.UnrecognizedExtension(x509.ObjectIdentifier(oid), b"\x05\x00"), critical=False)
    return b.sign(issuer_key, hashes.SHA256())


root_key, mid_key, leaf_key = (ec.generate_private_key(ec.SECP256R1()) for _ in range(3))
root = cert("root", root_key, root_key)
mid = cert("mid", root_key, mid_key, root.subject, "1.2.840.113635.100.6.2.1")
leaf = cert("leaf", mid_key, leaf_key, mid.subject, "1.2.840.113635.100.6.11.1", ca=False)
x5c = [base64.b64encode(c.public_bytes(serialization.Encoding.DER)).decode() for c in (leaf, mid, root)]
jws = jwt.encode({"productId": "p"}, leaf_key, algorithm="ES256", headers={"x5c": x5c})

try:
    billing.apple_decode(jws)
    raise AssertionError("a chain not ending in Apple's root must be refused")
except billing.BillingError:
    pass
billing.APPLE_ROOT_G3_SHA256 = root.fingerprint(hashes.SHA256()).hex()  # pretend it's Apple's
assert billing.apple_decode(jws) == {"productId": "p"}, "valid chain and signature"
other = ec.generate_private_key(ec.SECP256R1())
forged = jwt.encode({"productId": "p"}, other, algorithm="ES256", headers={"x5c": x5c})
try:
    billing.apple_decode(forged)
    raise AssertionError("a payload not signed by the leaf must be refused")
except billing.BillingError:
    pass
print("billing self-check passed")
