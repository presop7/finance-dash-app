"""Free vs Premium. Premium while the reverse trial or a paid period runs.

The free limits that live on the server are enforced here (funds, goals); the
app shows the same limits up front, this is what makes them stick.
"""
from datetime import datetime, timezone

from fastapi import HTTPException

from models.user import User

FREE_FUNDS = 2  # "Unassigned" isn't counted
FREE_GOALS = 1


def is_premium(user: User) -> bool:
    now = datetime.now(timezone.utc)
    return any(until is not None and until > now for until in (user.trial_ends_at, user.premium_until))


def require_premium_for(user: User, used: int, free_limit: int, what: str) -> None:
    """Refuses adding one more `what` when a free user already has the free amount."""
    if used >= free_limit and not is_premium(user):
        raise HTTPException(
            status_code=403,
            detail={"code": "premium_required", "message": f"Free plan includes {free_limit} {what}."},
        )
