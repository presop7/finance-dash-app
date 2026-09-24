import base64
import json
import logging
import os
import re
import time
import urllib.error
import urllib.request

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from auth import get_current_user
from config import settings
from models.user import User

router = APIRouter(prefix="/feedback", tags=["feedback"])
logger = logging.getLogger(__name__)

RESEND_EMAILS_URL = "https://api.resend.com/emails"

# Deliberately loose: just enough to catch an obviously malformed address
# (Resend answers 422 "The domain is invalid" for those) — not full RFC validation.
_EMAIL_RE = re.compile(r"^[^@\s<>\"]+@[^@\s<>\"]+\.[^@\s<>\"]+$")


def _clean_setting(value: str) -> str:
    # Env vars pasted into a dashboard often pick up wrapping quotes or stray
    # whitespace, which then reach the email API as part of the address.
    return value.strip().strip("\"'").strip()


MAX_TITLE_CHARS = 120
MAX_DESCRIPTION_CHARS = 4000
MAX_APP_INFO_CHARS = 500
MAX_ATTACHMENTS = 5
MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024
ALLOWED_ATTACHMENT_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/heic",
    "image/heif",
}

# Simple abuse guard: a signed-in user can send a handful of reports per hour.
# In-memory (per process), which is fine for a soft limit — a restart resets it.
RATE_LIMIT_MAX = 3
RATE_LIMIT_WINDOW_SECONDS = 60 * 60
_recent_sends: dict[str, list[float]] = {}


def _check_rate_limit(user_key: str) -> None:
    now = time.time()
    recent = [
        t
        for t in _recent_sends.get(user_key, [])
        if now - t < RATE_LIMIT_WINDOW_SECONDS
    ]
    if len(recent) >= RATE_LIMIT_MAX:
        _recent_sends[user_key] = recent
        raise HTTPException(
            status_code=429,
            detail="You've sent several reports recently — please try again in a little while.",
        )
    recent.append(now)
    _recent_sends[user_key] = recent


def _send_via_resend(payload: dict, api_key: str) -> None:
    request = urllib.request.Request(
        RESEND_EMAILS_URL,
        data=json.dumps(payload).encode("utf-8"),
        method="POST",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            # Resend sits behind Cloudflare, which rejects urllib's default
            # "Python-urllib" agent outright.
            "User-Agent": "finance-dash-api/1.0",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=20):
            return
    except urllib.error.HTTPError as exc:
        logger.error(
            "Resend rejected feedback email: %s %s (from=%r to=%r reply_to=%r)",
            exc.code,
            exc.read()[:500],
            payload.get("from"),
            payload.get("to"),
            payload.get("reply_to"),
        )
    except (urllib.error.URLError, TimeoutError) as exc:
        logger.error("Couldn't reach Resend: %s", exc)
    raise HTTPException(
        status_code=502,
        detail="Couldn't send your report right now — please try again in a moment.",
    )


@router.post("", status_code=204)
def send_feedback(
    title: str = Form(...),
    description: str = Form(...),
    app_info: str = Form(""),
    attachments: list[UploadFile] = File(default=[]),
    current_user: User = Depends(get_current_user),
) -> None:
    api_key = _clean_setting(settings.RESEND_API_KEY)
    to_email = _clean_setting(settings.FEEDBACK_TO_EMAIL)
    from_email = _clean_setting(settings.FEEDBACK_FROM_EMAIL)
    if not api_key or not to_email:
        raise HTTPException(
            status_code=503, detail="Feedback isn't set up on the server yet."
        )

    title = title.strip()
    description = description.strip()
    if not title or not description:
        raise HTTPException(
            status_code=422, detail="Please add a title and a description."
        )
    if len(title) > MAX_TITLE_CHARS:
        raise HTTPException(
            status_code=422, detail=f"Title is too long (max {MAX_TITLE_CHARS})."
        )
    if len(description) > MAX_DESCRIPTION_CHARS:
        raise HTTPException(
            status_code=422,
            detail=f"Description is too long (max {MAX_DESCRIPTION_CHARS}).",
        )
    if len(attachments) > MAX_ATTACHMENTS:
        raise HTTPException(
            status_code=422, detail=f"Attach at most {MAX_ATTACHMENTS} pictures."
        )

    encoded_attachments = []
    for index, upload in enumerate(attachments, start=1):
        if (upload.content_type or "").lower() not in ALLOWED_ATTACHMENT_TYPES:
            raise HTTPException(
                status_code=422, detail="Only image attachments are supported."
            )
        data = upload.file.read(MAX_ATTACHMENT_BYTES + 1)
        if len(data) > MAX_ATTACHMENT_BYTES:
            raise HTTPException(
                status_code=413,
                detail=f"Each picture must be under {MAX_ATTACHMENT_BYTES // (1024 * 1024)} MB.",
            )
        # Keep only the base name — never trust a client-supplied path.
        filename = os.path.basename(upload.filename or "") or f"picture-{index}.jpg"
        encoded_attachments.append(
            {"filename": filename, "content": base64.b64encode(data).decode("ascii")}
        )

    _check_rate_limit(str(current_user.id))

    body = (
        f"{description}\n\n"
        f"----\n"
        f"From: {current_user.display_name} <{current_user.email}>\n"
        f"User id: {current_user.id}\n"
        f"App info: {app_info.strip()[:MAX_APP_INFO_CHARS] or 'n/a'}\n"
        f"Pictures: {len(encoded_attachments)}\n"
    )
    payload: dict = {
        "from": from_email,
        "to": [to_email],
        "subject": f"[Finance Dash feedback] {title}",
        "text": body,
    }
    # So hitting Reply in your inbox goes straight to the person who reported it.
    if current_user.email and _EMAIL_RE.match(current_user.email):
        payload["reply_to"] = current_user.email
    if encoded_attachments:
        payload["attachments"] = encoded_attachments

    _send_via_resend(payload, api_key)
