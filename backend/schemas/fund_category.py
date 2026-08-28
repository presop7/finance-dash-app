import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class FundCategoryCreate(BaseModel):
    name: str
    currency: str
    icon: str | None = None
    color: str | None = None


class FundCategoryUpdate(BaseModel):
    name: str | None = None
    currency: str | None = None
    icon: str | None = None
    color: str | None = None


class FundCategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    name: str
    currency: str
    icon: str | None
    color: str | None
    created_at: datetime
