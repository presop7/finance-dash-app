import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from database import get_db
from models.transaction import Transaction
from schemas.transaction import TransactionCreate, TransactionOut

router = APIRouter(prefix="/transactions", tags=["transactions"])


@router.post("", response_model=TransactionOut, status_code=201)
def create_transaction(payload: TransactionCreate, db: Session = Depends(get_db)):
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
def list_transactions(db: Session = Depends(get_db)):
    return db.query(Transaction).all()


@router.get("/{transaction_id}", response_model=TransactionOut)
def get_transaction(transaction_id: uuid.UUID, db: Session = Depends(get_db)):
    transaction = db.get(Transaction, transaction_id)
    if transaction is None:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return transaction
