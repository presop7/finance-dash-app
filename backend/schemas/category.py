import uuid

from pydantic import BaseModel, ConfigDict

from models.category import CategoryType


class CategoryCreate(BaseModel):
    name: str
    icon: str | None = None
    type: CategoryType


class CategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID | None
    name: str
    icon: str | None
    type: CategoryType
