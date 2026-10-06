import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class UserCreate(BaseModel):
    auth_provider_id: str
    email: str
    display_name: str


class UserSettingsUpdate(BaseModel):
    currency: str | None = None
    hide_balance: bool | None = None
    time_format: str | None = None
    date_format: str | None = None


class CurrencyConversion(BaseModel):
    # from_currency must still be the account's currency: a retried request
    # (after a timeout) then can't convert the amounts a second time.
    from_currency: str = Field(pattern=r"^[A-Z]{3}$")
    to_currency: str = Field(pattern=r"^[A-Z]{3}$")
    # 1 from_currency = rate to_currency (the app shows it before confirming).
    rate: Decimal = Field(gt=0, lt=1_000_000)


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
    trial_ends_at: datetime | None = None
    premium_until: datetime | None = None
    dev_access: bool = False
    dev_access_requested_at: datetime | None = None
