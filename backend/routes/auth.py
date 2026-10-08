import json
import logging
import urllib.error
import urllib.request
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from auth import get_current_user
from config import settings
from database import get_db
from models.category import Category
from models.fund_category import FundCategory
from models.goal import Goal, GoalAllocation
from models.push_subscription import PushSubscription
from models.transaction import DeletedTransaction, Transaction
from models.user import User
from schemas.user import CurrencyConversion, UserOut, UserSettingsUpdate

router = APIRouter(prefix="/auth", tags=["auth"])
logger = logging.getLogger(__name__)


@router.get("/me", response_model=UserOut)
def read_current_user(current_user: User = Depends(get_current_user)):
    return current_user


@router.patch("/me", response_model=UserOut)
def update_current_user_settings(
    payload: UserSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(current_user, field, value)
    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/me/convert-currency", response_model=UserOut)
def convert_currency(
    payload: CurrencyConversion,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Switches the account to another currency and converts every saved
    amount with the given rate — all in one database transaction, so it's
    either fully done or not at all."""
    if payload.from_currency != current_user.currency:
        raise HTTPException(
            status_code=409,
            detail="Your currency was already changed. Refresh and try again.",
        )
    if payload.to_currency == payload.from_currency:
        return current_user
    own_funds = select(FundCategory.id).where(FundCategory.user_id == current_user.id)
    db.execute(
        update(Transaction)
        .where(Transaction.fund_category_id.in_(own_funds))
        .values(amount=func.round(Transaction.amount * payload.rate, 2), currency=payload.to_currency)
        .execution_options(synchronize_session=False)
    )
    own_goals = select(Goal.id).where(Goal.user_id == current_user.id)
    db.execute(
        update(Goal)
        .where(Goal.user_id == current_user.id)
        .values(target=func.round(Goal.target * payload.rate, 2))
        .execution_options(synchronize_session=False)
    )
    db.execute(
        update(GoalAllocation)
        .where(GoalAllocation.goal_id.in_(own_goals))
        .values(amount=func.round(GoalAllocation.amount * payload.rate, 2))
        .execution_options(synchronize_session=False)
    )
    db.execute(
        update(FundCategory)
        .where(FundCategory.user_id == current_user.id)
        .values(currency=payload.to_currency)
        .execution_options(synchronize_session=False)
    )
    current_user.currency = payload.to_currency
    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/me/request-dev-access", response_model=UserOut)
def request_dev_access(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Asks for the Play test version. Shows up in the users table as
    dev_access_requested_at; ticking dev_access there lets them in."""
    if current_user.dev_access_requested_at is None:
        current_user.dev_access_requested_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(current_user)
    return current_user


@router.delete("/me", status_code=204)
def delete_account(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Deletes the account and everything in it, then the sign-in itself.
    (A store subscription is separate: it's cancelled in Google Play.)"""
    if not settings.SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(status_code=503, detail="Account deletion isn't set up on the server yet.")
    own_funds = select(FundCategory.id).where(FundCategory.user_id == current_user.id)
    db.query(Goal).filter(Goal.user_id == current_user.id).delete(synchronize_session=False)
    db.query(Transaction).filter(Transaction.fund_category_id.in_(own_funds)).delete(synchronize_session=False)
    db.query(DeletedTransaction).filter(DeletedTransaction.user_id == current_user.id).delete(synchronize_session=False)
    db.query(FundCategory).filter(FundCategory.user_id == current_user.id).delete(synchronize_session=False)
    db.query(Category).filter(Category.user_id == current_user.id).delete(synchronize_session=False)
    db.query(PushSubscription).filter(PushSubscription.user_id == current_user.id).delete(synchronize_session=False)
    auth_id = current_user.auth_provider_id
    db.delete(current_user)
    db.commit()
    _delete_sign_in(auth_id)


def _admin_headers(key: str) -> dict:
    # Either kind of Supabase admin key works: the legacy service_role key (a
    # JWT, also sent as the bearer token) or a new secret key (sb_secret_...,
    # which goes in the apikey header only — it isn't a JWT).
    headers = {"apikey": key, "User-Agent": "finance-dash-api/1.0"}
    if key.startswith("eyJ"):
        headers["Authorization"] = f"Bearer {key}"
    return headers


def _delete_sign_in(auth_provider_id: str) -> None:
    """Removes the Supabase Auth user (email, Google link). The data is
    already gone; if this fails, signing in again just starts a new, empty
    account, so it's logged rather than reported to the user."""
    key = settings.SUPABASE_SERVICE_ROLE_KEY
    request = urllib.request.Request(
        f"{settings.SUPABASE_URL}/auth/v1/admin/users/{auth_provider_id}",
        method="DELETE",
        headers=_admin_headers(key),
    )
    try:
        with urllib.request.urlopen(request, timeout=20):
            return
    except urllib.error.HTTPError as exc:
        logger.error("Supabase refused deleting auth user %s: %s %s", auth_provider_id, exc.code, exc.read()[:300])
    except (urllib.error.URLError, TimeoutError) as exc:
        logger.error("Couldn't reach Supabase to delete auth user %s: %s", auth_provider_id, exc)
