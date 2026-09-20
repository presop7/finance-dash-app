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
from schemas.transaction import (
    TransactionBulkCreate,
    TransactionBulkFailure,
    TransactionBulkResult,
    TransactionCreate,
    TransactionOut,
    TransactionUpdate,
)

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


@router.post("/bulk", response_model=TransactionBulkResult, status_code=201)
def bulk_create_transactions(
    payload: TransactionBulkCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = payload.transactions

    # Ownership checks batched into one query per referenced set, instead of
    # the two queries per row _assert_fund_category_owned/_assert_category_accessible
    # do — that's what keeps this fast regardless of batch size.
    fund_category_ids = {row.fund_category_id for row in rows}
    owned_fund_category_ids = {
        fc.id
        for fc in db.query(FundCategory.id).filter(
            FundCategory.id.in_(fund_category_ids),
            FundCategory.user_id == current_user.id,
        )
    }

    category_ids = {row.category_id for row in rows}
    accessible_category_ids = {
        c.id
        for c in db.query(Category.id).filter(
            Category.id.in_(category_ids),
            or_(Category.user_id == current_user.id, Category.user_id.is_(None)),
        )
    }

    submitted_ids = {row.client_generated_id for row in rows}
    existing_ids = {
        t.client_generated_id
        for t in db.query(Transaction.client_generated_id).filter(
            Transaction.client_generated_id.in_(submitted_ids)
        )
    }

    skipped_duplicates = 0
    failed: list[TransactionBulkFailure] = []
    to_insert: list[Transaction] = []
    # Tracks ids already accepted in this batch, so a duplicate *within* the
    # request (shouldn't happen given client-generated UUIDs, but would
    # otherwise blow up the single commit at the end with an IntegrityError
    # and roll back every row) is skipped the same way a pre-existing one is.
    seen_ids: set[uuid.UUID] = set()

    for index, row in enumerate(rows):
        if row.client_generated_id in existing_ids or row.client_generated_id in seen_ids:
            skipped_duplicates += 1
            continue
        if row.fund_category_id not in owned_fund_category_ids:
            failed.append(TransactionBulkFailure(index=index, detail="Fund category not found"))
            continue
        if row.category_id not in accessible_category_ids:
            failed.append(TransactionBulkFailure(index=index, detail="Category not found"))
            continue
        seen_ids.add(row.client_generated_id)
        to_insert.append(Transaction(**row.model_dump()))

    db.add_all(to_insert)
    db.commit()
    for transaction in to_insert:
        db.refresh(transaction)

    return TransactionBulkResult(
        created=to_insert, skipped_duplicates=skipped_duplicates, failed=failed
    )


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
