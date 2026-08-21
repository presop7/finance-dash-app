import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class AccountCreate(BaseModel):
    user_id: uuid.UUID
    name: str
    currency: str


class AccountOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    name: str
    currency: str
    created_at: datetime
