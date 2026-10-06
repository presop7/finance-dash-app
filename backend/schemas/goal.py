import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class GoalCreate(BaseModel):
    name: str = Field(min_length=1)
    target: Decimal = Field(gt=0)
    icon: str | None = None
    color: str | None = None


class GoalUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1)
    target: Decimal | None = Field(default=None, gt=0)
    icon: str | None = None
    color: str | None = None


class GoalAllocationCreate(BaseModel):
    fund_category_id: uuid.UUID
    # Positive sets money aside, negative releases it.
    amount: Decimal


class GoalAllocationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    fund_category_id: uuid.UUID
    amount: Decimal
    occurred_at: datetime


class GoalOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    target: Decimal
    icon: str | None
    color: str | None
    created_at: datetime
    allocations: list[GoalAllocationOut]
