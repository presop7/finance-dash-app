import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models.fund_category import FundCategory
from models.transaction import Transaction
from models.user import User
from schemas.fund_category import FundCategoryCreate, FundCategoryOut, FundCategoryUpdate

router = APIRouter(prefix="/fund_categories", tags=["fund_categories"])


def _get_owned_fund_category(
    db: Session, fund_category_id: uuid.UUID, current_user: User
) -> FundCategory:
    fund_category = (
        db.query(FundCategory)
        .filter(FundCategory.id == fund_category_id, FundCategory.user_id == current_user.id)
        .first()
    )
    if fund_category is None:
        raise HTTPException(status_code=404, detail="Fund category not found")
    return fund_category


def _get_or_create_unassigned_fund_category(db: Session, current_user: User) -> FundCategory:
    fund_category = (
        db.query(FundCategory)
        .filter(FundCategory.user_id == current_user.id, FundCategory.name == "Unassigned")
        .first()
    )
    if fund_category is None:
        fund_category = FundCategory(
            user_id=current_user.id,
            name="Unassigned",
            currency=current_user.currency,
            icon="help-circle-outline",
            color="#5F5E5A",
        )
        db.add(fund_category)
        db.flush()
    return fund_category


@router.post("", response_model=FundCategoryOut, status_code=201)
def create_fund_category(
    payload: FundCategoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    fund_category = FundCategory(**payload.model_dump(), user_id=current_user.id)
    db.add(fund_category)
    db.commit()
    db.refresh(fund_category)
    return fund_category


@router.get("", response_model=list[FundCategoryOut])
def list_fund_categories(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return db.query(FundCategory).filter(FundCategory.user_id == current_user.id).all()


@router.get("/{fund_category_id}", response_model=FundCategoryOut)
def get_fund_category(
    fund_category_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _get_owned_fund_category(db, fund_category_id, current_user)


@router.patch("/{fund_category_id}", response_model=FundCategoryOut)
def update_fund_category(
    fund_category_id: uuid.UUID,
    payload: FundCategoryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    fund_category = _get_owned_fund_category(db, fund_category_id, current_user)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(fund_category, field, value)
    db.commit()
    db.refresh(fund_category)
    return fund_category


@router.delete("/{fund_category_id}", status_code=204)
def delete_fund_category(
    fund_category_id: uuid.UUID,
    confirm: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    fund_category = _get_owned_fund_category(db, fund_category_id, current_user)

    referencing_count = (
        db.query(Transaction).filter(Transaction.fund_category_id == fund_category.id).count()
    )

    if referencing_count > 0 and not confirm:
        raise HTTPException(
            status_code=409,
            detail={
                "message": (
                    f"{referencing_count} transaction"
                    f"{'' if referencing_count == 1 else 's'} "
                    f"{'uses' if referencing_count == 1 else 'use'} this fund category"
                ),
                "transaction_count": referencing_count,
            },
        )

    if referencing_count > 0:
        unassigned = _get_or_create_unassigned_fund_category(db, current_user)
        if unassigned.id == fund_category.id:
            raise HTTPException(status_code=400, detail="Cannot delete the Unassigned fund")
        db.query(Transaction).filter(Transaction.fund_category_id == fund_category.id).update(
            {Transaction.fund_category_id: unassigned.id}
        )

    db.delete(fund_category)
    db.commit()
