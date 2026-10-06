import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Numeric, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class Goal(Base):
    """A savings goal: money set aside toward a target. It's not a fund — the
    money stays in the user's real funds; each allocation records how much
    was set aside (or released) and in which fund it sits. An expense linked
    to the goal (Transaction.goal_id) marks it as used."""

    __tablename__ = "goals"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String, nullable=False)
    target: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    icon: Mapped[str | None] = mapped_column(String, nullable=True)
    color: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    allocations: Mapped[list["GoalAllocation"]] = relationship(
        back_populates="goal", cascade="all, delete-orphan", order_by="GoalAllocation.occurred_at"
    )


class GoalAllocation(Base):
    """Money set aside for a goal (positive) or released from it (negative),
    from one of the user's funds. Moves no money: it isn't income or expense."""

    __tablename__ = "goal_allocations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    goal_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("goals.id", ondelete="CASCADE"), nullable=False, index=True
    )
    fund_category_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("fund_categories.id"), nullable=False
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    goal: Mapped[Goal] = relationship(back_populates="allocations")
