import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models.category import Category
from models.fund_category import FundCategory
from models.transaction import Transaction
from models.user import User
from schemas.transaction import TransactionCreate, TransactionOut, TransactionUpdate

router = APIRouter(prefix="/transactions", tags=["transactions"])


def _assert_fund_category_owned(
    db: Session, fund_category_id: uuid.UUID, current_user: User
) -> None:
    fund_category = (
        db.query(FundCategory)
        .filter(FundCategory.id == fund_category_id, FundCategory.user_id == current_user.id)
        .first()
    )
    if fund_category is None:
        raise HTTPException(status_code=404, detail="Fund category not found")


def _assert_category_accessible(db: Session, category_id: uuid.UUID, current_user: User) -> None:
    category = (
        db.query(Category)
        .filter(
            Category.id == category_id,
            or_(Category.user_id == current_user.id, Category.user_id.is_(None)),
        )
        .first()
    )
    if category is None:
        raise HTTPException(status_code=404, detail="Category not found")


def _get_owned_transaction(
    db: Session, transaction_id: uuid.UUID, current_user: User
) -> Transaction:
    transaction = (
        db.query(Transaction)
        .join(FundCategory, Transaction.fund_category_id == FundCategory.id)
        .filter(Transaction.id == transaction_id, FundCategory.user_id == current_user.id)
        .first()
    )
    if transaction is None:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return transaction


@router.post("", response_model=TransactionOut, status_code=201)
def create_transaction(
    payload: TransactionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _assert_fund_category_owned(db, payload.fund_category_id, current_user)
    _assert_category_accessible(db, payload.category_id, current_user)

    transaction = Transaction(**payload.model_dump())
    db.add(transaction)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="A transaction with this client_generated_id already exists",
        )
    db.refresh(transaction)
    return transaction


@router.get("", response_model=list[TransactionOut])
def list_transactions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(Transaction)
        .join(FundCategory, Transaction.fund_category_id == FundCategory.id)
        .filter(FundCategory.user_id == current_user.id)
        .all()
    )


@router.get("/{transaction_id}", response_model=TransactionOut)
def get_transaction(
    transaction_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _get_owned_transaction(db, transaction_id, current_user)


@router.patch("/{transaction_id}", response_model=TransactionOut)
def update_transaction(
    transaction_id: uuid.UUID,
    payload: TransactionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    transaction = _get_owned_transaction(db, transaction_id, current_user)
    data = payload.model_dump(exclude_unset=True)
    if "fund_category_id" in data:
        _assert_fund_category_owned(db, data["fund_category_id"], current_user)
    if "category_id" in data:
        _assert_category_accessible(db, data["category_id"], current_user)
    for field, value in data.items():
        setattr(transaction, field, value)
    db.commit()
    db.refresh(transaction)
    return transaction


@router.delete("/{transaction_id}", status_code=204)
def delete_transaction(
    transaction_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    transaction = _get_owned_transaction(db, transaction_id, current_user)
    db.delete(transaction)
    db.commit()
