"""Web push: daily reminders for the web version, delivered even when it's closed.

Browsers subscribe through PUT /push/subscription with their reminder times.
Supabase's scheduler (pg_cron) calls POST /push/send-due every minute, which
sends each reminder whose time has come. The phone apps don't use this — they
schedule their reminders on the device.
"""

import hmac
import json
import logging
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field, field_validator
from pywebpush import WebPushException, webpush
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from auth import get_current_user
from config import settings
from database import get_db
from models.push_subscription import PushSubscription
from models.user import User

router = APIRouter(prefix="/push", tags=["push"])
logger = logging.getLogger(__name__)

# A reminder is still sent if the scheduler runs up to this late (e.g. the
# server was waking up); older ones are skipped rather than arriving hours off.
SEND_WINDOW = timedelta(minutes=30)


class SubscriptionKeys(BaseModel):
    p256dh: str = Field(max_length=200)
    auth: str = Field(max_length=200)


class SubscriptionIn(BaseModel):
    endpoint: str = Field(max_length=1000)
    keys: SubscriptionKeys
    times: list[int] = Field(max_length=20)
    timezone: str = Field(max_length=64)
    title: str = Field(max_length=200)
    body: str = Field(max_length=300)

    @field_validator("endpoint")
    @classmethod
    def https_only(cls, value: str) -> str:
        # Push services are always https; anything else would make this server
        # post to an address of the caller's choosing.
        if not value.startswith("https://"):
            raise ValueError("endpoint must be https")
        return value

    @field_validator("times")
    @classmethod
    def minutes_of_day(cls, value: list[int]) -> list[int]:
        if any(not 0 <= m < 24 * 60 for m in value):
            raise ValueError("times are minutes after midnight (0-1439)")
        return sorted(set(value))

    @field_validator("timezone")
    @classmethod
    def known_timezone(cls, value: str) -> str:
        try:
            ZoneInfo(value)
        except (ZoneInfoNotFoundError, ValueError):
            raise ValueError("unknown timezone")
        return value


def _require_push_configured() -> None:
    if not settings.VAPID_PUBLIC_KEY or not settings.VAPID_PRIVATE_KEY:
        raise HTTPException(status_code=503, detail="Push notifications aren't set up on the server yet.")


@router.get("/public-key")
def public_key() -> dict:
    _require_push_configured()
    return {"key": settings.VAPID_PUBLIC_KEY}


@router.put("/subscription", status_code=204)
def save_subscription(
    payload: SubscriptionIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    _require_push_configured()
    sub = db.scalar(select(PushSubscription).where(PushSubscription.endpoint == payload.endpoint))
    if sub is None:
        sub = PushSubscription(endpoint=payload.endpoint)
        db.add(sub)
    # A browser belongs to whoever signed in on it last.
    sub.user_id = current_user.id
    sub.p256dh = payload.keys.p256dh
    sub.auth = payload.keys.auth
    sub.times = payload.times
    sub.timezone = payload.timezone
    sub.title = payload.title
    sub.body = payload.body
    db.commit()


@router.delete("/subscription", status_code=204)
def delete_subscription(
    endpoint: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    db.execute(
        delete(PushSubscription).where(
            PushSubscription.endpoint == endpoint, PushSubscription.user_id == current_user.id
        )
    )
    db.commit()


def is_due(times: list[int], tz: str, last_sent_at: datetime | None, now: datetime) -> bool:
    """Whether one of today's reminder times (in the browser's own timezone)
    has passed within SEND_WINDOW and hasn't been sent yet. The database
    function push_reminders_due() applies the same rule to decide when to
    call send-due at all, except it starts 2 minutes early so a sleeping
    server is awake by then (migration a4d2e6f8b9c1) — keep the two in step."""
    local_now = now.astimezone(ZoneInfo(tz))
    for minutes in times:
        slot = local_now.replace(hour=minutes // 60, minute=minutes % 60, second=0, microsecond=0)
        if slot <= local_now < slot + SEND_WINDOW and (last_sent_at is None or last_sent_at < slot):
            return True
    return False


@router.post("/send-due")
def send_due(
    x_cron_secret: str = Header(default=""),
    db: Session = Depends(get_db),
) -> dict:
    if not settings.CRON_SECRET or not hmac.compare_digest(x_cron_secret, settings.CRON_SECRET):
        raise HTTPException(status_code=403, detail="Forbidden")
    _require_push_configured()

    now = datetime.now(timezone.utc)
    sent = removed = 0
    # Locked while sending, and skipped by any overlapping call (the scheduler
    # can call again while a sleeping server is still waking up), so nothing
    # is sent twice.
    # ponytail: scans every subscription with times; fine into the thousands,
    # index/bucket by next due time if it grows past that.
    query = (
        select(PushSubscription)
        .where(func.cardinality(PushSubscription.times) > 0)
        .with_for_update(skip_locked=True)
    )
    for sub in db.scalars(query):
        if not is_due(sub.times, sub.timezone, sub.last_sent_at, now):
            continue
        try:
            webpush(
                subscription_info={"endpoint": sub.endpoint, "keys": {"p256dh": sub.p256dh, "auth": sub.auth}},
                data=json.dumps({"title": sub.title, "body": sub.body}),
                vapid_private_key=settings.VAPID_PRIVATE_KEY,
                vapid_claims={"sub": settings.VAPID_SUBJECT},
                ttl=60 * 60,
                timeout=10,
            )
            sub.last_sent_at = now
            sent += 1
        except WebPushException as exc:
            status = exc.response.status_code if exc.response is not None else None
            if status in (404, 410):  # the browser unsubscribed or was reset
                db.delete(sub)
                removed += 1
            else:
                logger.warning("Web push failed (%s) for subscription %s", status, sub.id)
    db.commit()
    return {"sent": sent, "removed": removed}
