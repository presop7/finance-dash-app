"""play foundation: plan + dev access on users; change tracking for transactions

Revision ID: c7d2f4a8e1b9
Revises: b3f9e1c7a2d5
Create Date: 2026-10-07 00:00:00.000000

Everything here is additive and kept correct by the database itself
(triggers), so the backend still running the older code (the testers'
version on the same database) keeps working and keeps these up to date.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'c7d2f4a8e1b9'
down_revision: Union[str, Sequence[str], None] = 'b3f9e1c7a2d5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Plan: Premium while either date is in the future. trial_ends_at is set
    # when a new account is created (10-day reverse trial); premium_until will
    # come from store billing (for now it can be set by hand for testing).
    op.add_column('users', sa.Column('trial_ends_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('users', sa.Column('premium_until', sa.DateTime(timezone=True), nullable=True))
    # Who may use the Play test version (the dev link), and who asked to.
    op.add_column('users', sa.Column('dev_access', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('users', sa.Column('dev_access_requested_at', sa.DateTime(timezone=True), nullable=True))

    # Change tracking, so the app fetches only what changed since its last
    # sync instead of every transaction on every open.
    op.add_column('transactions', sa.Column(
        'updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False))
    op.create_index('ix_transactions_updated_at', 'transactions', ['updated_at'])
    op.execute("""
        CREATE OR REPLACE FUNCTION public.set_transaction_updated_at() RETURNS trigger
        LANGUAGE plpgsql SET search_path = public AS $$
        BEGIN
          NEW.updated_at = now();
          RETURN NEW;
        END;
        $$
    """)
    op.execute("""
        CREATE TRIGGER transactions_set_updated_at BEFORE UPDATE ON public.transactions
        FOR EACH ROW EXECUTE FUNCTION public.set_transaction_updated_at()
    """)

    op.create_table(
        'deleted_transactions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_deleted_transactions_user_deleted', 'deleted_transactions', ['user_id', 'deleted_at'])
    op.execute("""
        CREATE OR REPLACE FUNCTION public.record_deleted_transaction() RETURNS trigger
        LANGUAGE plpgsql SET search_path = public AS $$
        BEGIN
          INSERT INTO deleted_transactions (id, user_id)
          SELECT OLD.id, fc.user_id FROM fund_categories fc WHERE fc.id = OLD.fund_category_id
          ON CONFLICT (id) DO UPDATE SET deleted_at = now();
          RETURN OLD;
        END;
        $$
    """)
    op.execute("""
        CREATE TRIGGER transactions_record_deleted AFTER DELETE ON public.transactions
        FOR EACH ROW EXECUTE FUNCTION public.record_deleted_transaction()
    """)
    # Same as every other public table: no access through Supabase's REST API
    # (see b7c1e2d4a9f0); only the backend, as table owner, reads it.
    op.execute('ALTER TABLE deleted_transactions ENABLE ROW LEVEL SECURITY')


def downgrade() -> None:
    op.execute('DROP TRIGGER IF EXISTS transactions_record_deleted ON public.transactions')
    op.execute('DROP FUNCTION IF EXISTS public.record_deleted_transaction()')
    op.drop_table('deleted_transactions')
    op.execute('DROP TRIGGER IF EXISTS transactions_set_updated_at ON public.transactions')
    op.execute('DROP FUNCTION IF EXISTS public.set_transaction_updated_at()')
    op.drop_index('ix_transactions_updated_at', table_name='transactions')
    op.drop_column('transactions', 'updated_at')
    op.drop_column('users', 'dev_access_requested_at')
    op.drop_column('users', 'dev_access')
    op.drop_column('users', 'premium_until')
    op.drop_column('users', 'trial_ends_at')
