from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models.fund_category import FundCategory
from models.goal import Goal, GoalAllocation
from models.transaction import Transaction
from models.user import User
from schemas.user import CurrencyConversion, UserOut, UserSettingsUpdate

router = APIRouter(prefix="/auth", tags=["auth"])


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
