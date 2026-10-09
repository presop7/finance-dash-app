"""subscriptions (Google Play / App Store / Paddle) and the plan's source

Revision ID: f7c1d9e3a5b8
Revises: e5a9c3d7b2f4
Create Date: 2026-10-09 18:00:00.000000

Additive: a new table and two nullable columns the older backend never reads.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = 'f7c1d9e3a5b8'
down_revision: Union[str, Sequence[str], None] = 'e5a9c3d7b2f4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'subscriptions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('source', sa.String(), nullable=False),
        sa.Column('external_id', sa.String(), nullable=False),
        sa.Column('product_id', sa.String(), nullable=True),
        sa.Column('status', sa.String(), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('event_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('raw', postgresql.JSONB(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint('source', 'external_id'),
    )
    op.create_index('ix_subscriptions_user_id', 'subscriptions', ['user_id'])
    # Where the paid plan comes from, and a payment problem to tell the user about.
    op.add_column('users', sa.Column('premium_source', sa.String(), nullable=True))
    op.add_column('users', sa.Column('billing_issue', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'billing_issue')
    op.drop_column('users', 'premium_source')
    op.drop_index('ix_subscriptions_user_id', table_name='subscriptions')
    op.drop_table('subscriptions')
