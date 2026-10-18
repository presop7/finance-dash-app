import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class FundCategoryCreate(BaseModel):
    # Optional id chosen by the app, so it can use the new item at once and
    # sync it later; sending the same create again returns the existing one.
    id: uuid.UUID | None = None
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
