"""push_subscriptions: browsers subscribed to web push reminders

Revision ID: e2b7c9d4f1a6
Revises: d9a3f6b1c2e4
Create Date: 2026-09-29 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'e2b7c9d4f1a6'
down_revision: Union[str, Sequence[str], None] = 'd9a3f6b1c2e4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'push_subscriptions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('endpoint', sa.String(), nullable=False, unique=True),
        sa.Column('p256dh', sa.String(), nullable=False),
        sa.Column('auth', sa.String(), nullable=False),
        sa.Column('times', postgresql.ARRAY(sa.Integer()), nullable=False, server_default='{}'),
        sa.Column('timezone', sa.String(), nullable=False, server_default='UTC'),
        sa.Column('title', sa.String(), nullable=False, server_default=''),
        sa.Column('body', sa.String(), nullable=False, server_default=''),
        sa.Column('last_sent_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_push_subscriptions_user_id', 'push_subscriptions', ['user_id'])
    # Same as every other public table: no access through Supabase's REST API
    # (see b7c1e2d4a9f0); only the backend, as table owner, reads it.
    op.execute('ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY')


def downgrade() -> None:
    op.drop_table('push_subscriptions')
