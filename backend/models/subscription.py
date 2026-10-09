import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class Subscription(Base):
    """A paid Premium subscription from one source (google / apple / paddle),
    as that source last reported it. users.premium_until follows these (see
    billing.recompute)."""

    __tablename__ = "subscriptions"
    __table_args__ = (UniqueConstraint("source", "external_id"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    source: Mapped[str] = mapped_column(String, nullable=False)
    # Google purchase token / Apple original transaction id / Paddle subscription id
    external_id: Mapped[str] = mapped_column(String, nullable=False)
    product_id: Mapped[str | None] = mapped_column(String, nullable=True)
    # active | grace | canceled (still paid up, won't renew) | on_hold | paused
    # | pending | expired | replaced
    status: Mapped[str] = mapped_column(String, nullable=False)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # When the source produced this state: older reports never overwrite newer.
    event_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    raw: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
