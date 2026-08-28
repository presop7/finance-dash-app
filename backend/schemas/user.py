import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class UserCreate(BaseModel):
    auth_provider_id: str
    email: str
    display_name: str


class UserSettingsUpdate(BaseModel):
    currency: str | None = None
    hide_balance: bool | None = None
    time_format: str | None = None
    date_format: str | None = None


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    auth_provider_id: str
    email: str
    display_name: str
    created_at: datetime
    currency: str
    hide_balance: bool
    time_format: str
    date_format: str
