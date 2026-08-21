import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class UserCreate(BaseModel):
    auth_provider_id: str
    email: str
    display_name: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    auth_provider_id: str
    email: str
    display_name: str
    created_at: datetime
