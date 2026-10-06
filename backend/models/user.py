import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    auth_provider_id: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String, nullable=False)
    display_name: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    currency: Mapped[str] = mapped_column(String, nullable=False, server_default="EUR")
    hide_balance: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    time_format: Mapped[str] = mapped_column(String, nullable=False, server_default="24h")
    date_format: Mapped[str] = mapped_column(
        String, nullable=False, server_default="DD/MM/YYYY"
    )

    # Plan (see plan.py): Premium while either is in the future.
    trial_ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    premium_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # The Play test version (dev link) only lets these in.
    dev_access: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    dev_access_requested_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    fund_categories: Mapped[list["FundCategory"]] = relationship(back_populates="user")
    categories: Mapped[list["Category"]] = relationship(back_populates="user")
