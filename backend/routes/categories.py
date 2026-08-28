import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models.category import Category, CategoryType
from models.transaction import Transaction
from models.user import User
from schemas.category import CategoryCreate, CategoryOut, CategoryUpdate

router = APIRouter(prefix="/categories", tags=["categories"])


def _get_editable_category(db: Session, category_id: uuid.UUID, current_user: User) -> Category:
    category = (
        db.query(Category)
        .filter(Category.id == category_id, Category.user_id == current_user.id)
        .first()
    )
    if category is None:
        raise HTTPException(status_code=404, detail="Category not found or not editable")
    return category


def _get_unassigned_category(db: Session, category_type: CategoryType) -> Category:
    category = (
        db.query(Category)
        .filter(
            Category.user_id.is_(None),
            Category.name == "Unassigned",
            Category.type == category_type,
        )
        .first()
    )
    if category is None:
        raise HTTPException(
            status_code=500,
            detail=f"No global Unassigned category seeded for type {category_type}",
        )
    return category


@router.post("", response_model=CategoryOut, status_code=201)
def create_category(
    payload: CategoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    category = Category(**payload.model_dump(), user_id=current_user.id)
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


@router.get("", response_model=list[CategoryOut])
def list_categories(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(Category)
        .filter(or_(Category.user_id == current_user.id, Category.user_id.is_(None)))
        .all()
    )


@router.get("/{category_id}", response_model=CategoryOut)
def get_category(
    category_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
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
    return category


@router.patch("/{category_id}", response_model=CategoryOut)
def update_category(
    category_id: uuid.UUID,
    payload: CategoryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    category = _get_editable_category(db, category_id, current_user)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(category, field, value)
    db.commit()
    db.refresh(category)
    return category


@router.delete("/{category_id}", status_code=204)
def delete_category(
    category_id: uuid.UUID,
    confirm: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    category = _get_editable_category(db, category_id, current_user)

    referencing_count = (
        db.query(Transaction).filter(Transaction.category_id == category.id).count()
    )

    if referencing_count > 0 and not confirm:
        raise HTTPException(
            status_code=409,
            detail={
                "message": (
                    f"{referencing_count} transaction"
                    f"{'' if referencing_count == 1 else 's'} "
                    f"{'uses' if referencing_count == 1 else 'use'} this category"
                ),
                "transaction_count": referencing_count,
            },
        )

    if referencing_count > 0:
        unassigned = _get_unassigned_category(db, category.type)
        db.query(Transaction).filter(Transaction.category_id == category.id).update(
            {Transaction.category_id: unassigned.id}
        )

    db.delete(category)
    db.commit()
