import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

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


class TransactionBulkCreate(BaseModel):
    # Capped so one request can't be used to force an unbounded batch insert -
    # nothing else in this app limits request body size.
    transactions: list[TransactionCreate] = Field(min_length=1, max_length=500)


class TransactionBulkFailure(BaseModel):
    index: int
    detail: str


class TransactionBulkResult(BaseModel):
    created: list[TransactionOut]
    skipped_duplicates: int
    failed: list[TransactionBulkFailure]
