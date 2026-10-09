import base64
import hmac
import json
import logging

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

import billing
from auth import get_current_user
from config import settings
from database import get_db
from models.subscription import Subscription
from models.user import User
from schemas.user import UserOut

router = APIRouter(prefix="/billing", tags=["billing"])
logger = logging.getLogger(__name__)


def _not_configured():
    return HTTPException(status_code=503, detail={"code": "billing_not_configured"})


def _owned_elsewhere():
    return HTTPException(status_code=409, detail={"code": "purchase_owned_by_another_account"})


def _owner(db: Session, existing: Subscription | None, account: str | None):
    """Whose subscription a store/Paddle notice is about: the account it's
    already linked to, or the one the purchase was made for."""
    if existing:
        return existing.user_id
    user = billing.user_by_id(db, account)
    return user.id if user else None


def _row(db: Session, source: str, external_id: str) -> Subscription | None:
    return db.query(Subscription).filter_by(source=source, external_id=external_id).first()


# ---- Google Play ----


class GooglePurchase(BaseModel):
    purchase_token: str
    product_id: str


@router.post("/google/verify", response_model=UserOut)
def google_verify(body: GooglePurchase, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """The app just bought (or restored) a subscription: read it from Google."""
    if not billing.google_configured():
        raise _not_configured()
    try:
        data = billing.google_subscription(body.purchase_token)
    except billing.BillingError as exc:
        logger.warning("google verify failed: %s", exc)
        raise HTTPException(status_code=400, detail={"code": "purchase_not_found"})
    state = billing.from_google(data)
    existing = _row(db, "google", body.purchase_token)
    if billing.owner_conflict(db, user, state["account"]) or (existing and existing.user_id != user.id):
        raise _owned_elsewhere()
    if not state["acknowledged"] and state["status"] in billing.LIVE:
        try:
            billing.google_acknowledge(state["product_id"] or body.product_id, body.purchase_token)
        except billing.BillingError as exc:  # the app acknowledges too (finishTransaction)
            logger.warning("google acknowledge failed: %s", exc)
    if state["linked_token"]:  # an upgrade/re-subscribe replaces the old purchase
        old = _row(db, "google", state["linked_token"])
        if old and old.user_id == user.id:
            old.status = "replaced"
    billing.save(db, user.id, "google", body.purchase_token, state, data)
    db.commit()
    db.refresh(user)
    return user


@router.post("/google/rtdn", status_code=204)
def google_rtdn(request_body: dict, token: str = "", db: Session = Depends(get_db)):
    """Real-time developer notifications (Pub/Sub push). The push URL carries
    ?token=GOOGLE_RTDN_TOKEN. Whatever the notification says, the subscription
    is read again from Google."""
    if not settings.GOOGLE_RTDN_TOKEN or not hmac.compare_digest(token, settings.GOOGLE_RTDN_TOKEN):
        raise HTTPException(status_code=403)
    try:
        message = json.loads(base64.b64decode(request_body["message"]["data"]))
    except Exception:
        return Response(status_code=204)  # not a notification: drop it (no retries)
    if message.get("packageName") != settings.GOOGLE_PLAY_PACKAGE:
        return Response(status_code=204)
    note = message.get("subscriptionNotification") or message.get("voidedPurchaseNotification") or {}
    purchase_token = note.get("purchaseToken")
    if not purchase_token:
        return Response(status_code=204)  # test notification, one-time products
    try:
        data = billing.google_subscription(purchase_token)
    except billing.BillingError as exc:
        logger.warning("rtdn read failed: %s", exc)
        raise HTTPException(status_code=502)  # Pub/Sub retries later
    state = billing.from_google(data)
    user_id = _owner(db, _row(db, "google", purchase_token), state["account"])
    if user_id is None:
        return Response(status_code=204)  # the app's verify call will link it
    billing.save(db, user_id, "google", purchase_token, state, data)
    db.commit()
    return Response(status_code=204)


# ---- App Store ----


class ApplePurchase(BaseModel):
    signed_transaction: str


@router.post("/apple/verify", response_model=UserOut)
def apple_verify(body: ApplePurchase, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    try:
        tx = billing.apple_decode(body.signed_transaction)
    except billing.BillingError as exc:
        logger.warning("apple verify failed: %s", exc)
        raise HTTPException(status_code=400, detail={"code": "invalid_purchase"})
    state = billing.from_apple(tx)
    if state["bundle_id"] != settings.APPLE_BUNDLE_ID:
        raise HTTPException(status_code=400, detail={"code": "invalid_purchase"})
    existing = _row(db, "apple", state["external_id"])
    if billing.owner_conflict(db, user, state["account"]) or (existing and existing.user_id != user.id):
        raise _owned_elsewhere()
    billing.save(db, user.id, "apple", state["external_id"], state, tx, billing.parse_time(tx.get("signedDate")))
    db.commit()
    db.refresh(user)
    return user


class AppleNotification(BaseModel):
    signedPayload: str


@router.post("/apple/notifications", status_code=204)
def apple_notifications(body: AppleNotification, db: Session = Depends(get_db)):
    """App Store Server Notifications V2."""
    try:
        payload = billing.apple_decode(body.signedPayload)
        data = payload.get("data") or {}
        if data.get("bundleId") != settings.APPLE_BUNDLE_ID or not data.get("signedTransactionInfo"):
            return Response(status_code=204)  # another app, or a TEST notification
        tx = billing.apple_decode(data["signedTransactionInfo"])
        renewal = billing.apple_decode(data["signedRenewalInfo"]) if data.get("signedRenewalInfo") else None
    except billing.BillingError as exc:
        logger.warning("apple notification rejected: %s", exc)
        raise HTTPException(status_code=400)
    state = billing.from_apple(tx, renewal, payload.get("notificationType"), payload.get("subtype"))
    user_id = _owner(db, _row(db, "apple", state["external_id"]), state["account"])
    if user_id is not None:
        billing.save(db, user_id, "apple", state["external_id"], state, tx, billing.parse_time(payload.get("signedDate")))
        db.commit()
    return Response(status_code=204)


# ---- Paddle (web) ----


@router.post("/paddle/webhook", status_code=204)
async def paddle_webhook(request: Request, db: Session = Depends(get_db)):
    body = await request.body()
    if not billing.paddle_signature_ok(request.headers.get("Paddle-Signature", ""), body, settings.PADDLE_WEBHOOK_SECRET):
        raise HTTPException(status_code=401)
    event = json.loads(body)
    if not str(event.get("event_type", "")).startswith("subscription."):
        return Response(status_code=204)
    sub = event.get("data") or {}
    state = billing.from_paddle(sub)
    user_id = _owner(db, _row(db, "paddle", state["external_id"]), state["account"])
    if user_id is None:
        logger.warning("paddle subscription %s without a known user", state["external_id"])
        return Response(status_code=204)
    raw = {"customer_id": sub.get("customer_id"), "status": sub.get("status"), "event_type": event.get("event_type")}
    billing.save(db, user_id, "paddle", state["external_id"], state, raw, billing.parse_time(event.get("occurred_at")))
    db.commit()
    return Response(status_code=204)


@router.post("/paddle/portal")
def paddle_portal(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """A link to Paddle's page for managing the subscription (card, cancel)."""
    if not settings.PADDLE_API_KEY:
        raise _not_configured()
    sub = (
        db.query(Subscription)
        .filter_by(user_id=user.id, source="paddle")
        .order_by(Subscription.updated_at.desc())
        .first()
    )
    if sub is None or not (sub.raw or {}).get("customer_id"):
        raise HTTPException(status_code=404, detail={"code": "no_subscription"})
    try:
        return {"url": billing.paddle_portal_url(sub.raw["customer_id"], sub.external_id)}
    except billing.BillingError as exc:
        logger.warning("paddle portal failed: %s", exc)
        raise HTTPException(status_code=502)
