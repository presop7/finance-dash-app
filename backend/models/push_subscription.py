import uuid
from datetime import datetime

from sqlalchemy import ARRAY, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class PushSubscription(Base):
    """One browser that accepted web push, with its daily reminder times.

    Alert rules live on the device, so each browser sends its own reminder
    times (and the text, already in the app's language) when they change.
    """

    __tablename__ = "push_subscriptions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # The push service address for this browser; unique per browser.
    endpoint: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    p256dh: Mapped[str] = mapped_column(String, nullable=False)
    auth: Mapped[str] = mapped_column(String, nullable=False)
    # Reminder times as minutes after midnight, in `timezone`.
    times: Mapped[list[int]] = mapped_column(ARRAY(Integer), nullable=False, server_default="{}")
    timezone: Mapped[str] = mapped_column(String, nullable=False, server_default="UTC")
    title: Mapped[str] = mapped_column(String, nullable=False, server_default="")
    body: Mapped[str] = mapped_column(String, nullable=False, server_default="")
    last_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
