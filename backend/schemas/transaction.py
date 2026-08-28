import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict

from models.transaction import TransactionType


class TransactionCreate(BaseModel):
    title: str
    fund_category_id: uuid.UUID
    category_id: uuid.UUID
    amount: Decimal
    currency: str
    type: TransactionType
    note: str | None = None
    occurred_at: datetime
    client_generated_id: uuid.UUID


class TransactionUpdate(BaseModel):
    title: str | None = None
    fund_category_id: uuid.UUID | None = None
    category_id: uuid.UUID | None = None
    amount: Decimal | None = None
    currency: str | None = None
    type: TransactionType | None = None
    note: str | None = None
    occurred_at: datetime | None = None


class TransactionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    fund_category_id: uuid.UUID
    category_id: uuid.UUID
    amount: Decimal
    currency: str
    type: TransactionType
    note: str | None
    occurred_at: datetime
    created_at: datetime
    client_generated_id: uuid.UUID
