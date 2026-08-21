import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict

from models.transaction import TransactionType


class TransactionCreate(BaseModel):
    account_id: uuid.UUID
    category_id: uuid.UUID
    amount: Decimal
    currency: str
    type: TransactionType
    note: str | None = None
    occurred_at: datetime
    client_generated_id: uuid.UUID


class TransactionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    account_id: uuid.UUID
    category_id: uuid.UUID
    amount: Decimal
    currency: str
    type: TransactionType
    note: str | None
    occurred_at: datetime
    created_at: datetime
    client_generated_id: uuid.UUID
