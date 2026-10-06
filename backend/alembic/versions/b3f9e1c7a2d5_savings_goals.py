"""savings goals: goals, goal_allocations, transactions.goal_id

Revision ID: b3f9e1c7a2d5
Revises: a4d2e6f8b9c1
Create Date: 2026-10-06 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'b3f9e1c7a2d5'
down_revision: Union[str, Sequence[str], None] = 'a4d2e6f8b9c1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'goals',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('target', sa.Numeric(12, 2), nullable=False),
        sa.Column('icon', sa.String(), nullable=True),
        sa.Column('color', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_goals_user_id', 'goals', ['user_id'])
    op.create_table(
        'goal_allocations',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('goal_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('goals.id', ondelete='CASCADE'), nullable=False),
        sa.Column('fund_category_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('fund_categories.id'), nullable=False),
        sa.Column('amount', sa.Numeric(12, 2), nullable=False),
        sa.Column('occurred_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_goal_allocations_goal_id', 'goal_allocations', ['goal_id'])
    # Additive and nullable: older app versions never send or read it.
    op.add_column('transactions', sa.Column(
        'goal_id', postgresql.UUID(as_uuid=True),
        sa.ForeignKey('goals.id', ondelete='SET NULL'), nullable=True))
    # Same as every other public table: no access through Supabase's REST API
    # (see b7c1e2d4a9f0); only the backend, as table owner, reads them.
    op.execute('ALTER TABLE goals ENABLE ROW LEVEL SECURITY')
    op.execute('ALTER TABLE goal_allocations ENABLE ROW LEVEL SECURITY')


def downgrade() -> None:
    op.drop_column('transactions', 'goal_id')
    op.drop_table('goal_allocations')
    op.drop_table('goals')
