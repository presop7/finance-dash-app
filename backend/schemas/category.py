import uuid

from pydantic import BaseModel, ConfigDict

from models.category import CategoryType


class CategoryCreate(BaseModel):
    # Optional id chosen by the app, so it can use the new item at once and
    # sync it later; sending the same create again returns the existing one.
    id: uuid.UUID | None = None
    name: str
    icon: str | None = None
    color: str | None = None
    type: CategoryType


class CategoryUpdate(BaseModel):
    name: str | None = None
    icon: str | None = None
    color: str | None = None
    type: CategoryType | None = None


class CategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID | None
    name: str
    icon: str | None
    color: str | None
    type: CategoryType
