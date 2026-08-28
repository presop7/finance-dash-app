"""rename accounts to fund_categories, add title/color/settings columns

Revision ID: 09445565a607
Revises: f801b1aa98bc
Create Date: 2026-08-24 00:02:51.259721

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '09445565a607'
down_revision: Union[str, Sequence[str], None] = 'f801b1aa98bc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # accounts -> fund_categories (rename, not drop+create, so existing rows survive)
    op.rename_table('accounts', 'fund_categories')
    op.add_column('fund_categories', sa.Column('icon', sa.String(), nullable=True))
    op.add_column('fund_categories', sa.Column('color', sa.String(), nullable=True))

    op.add_column('categories', sa.Column('color', sa.String(), nullable=True))

    # title added nullable first, backfilled, then locked to NOT NULL
    op.add_column('transactions', sa.Column('title', sa.String(), nullable=True))
    op.execute("UPDATE transactions SET title = '' WHERE title IS NULL")
    op.alter_column('transactions', 'title', nullable=False)

    # account_id -> fund_category_id (rename; the FK constraint keeps working since
    # Postgres tracks it by OID, not name — renamed here too just for readability)
    op.alter_column('transactions', 'account_id', new_column_name='fund_category_id')
    op.execute(
        "ALTER TABLE transactions RENAME CONSTRAINT transactions_account_id_fkey "
        "TO transactions_fund_category_id_fkey"
    )

    op.add_column('users', sa.Column('currency', sa.String(), nullable=False, server_default='BGN'))
    op.add_column(
        'users', sa.Column('hide_balance', sa.Boolean(), nullable=False, server_default='false')
    )
    op.add_column(
        'users', sa.Column('time_format', sa.String(), nullable=False, server_default='24h')
    )
    op.add_column(
        'users',
        sa.Column('date_format', sa.String(), nullable=False, server_default='DD/MM/YYYY'),
    )


def downgrade() -> None:
    op.drop_column('users', 'date_format')
    op.drop_column('users', 'time_format')
    op.drop_column('users', 'hide_balance')
    op.drop_column('users', 'currency')

    op.execute(
        "ALTER TABLE transactions RENAME CONSTRAINT transactions_fund_category_id_fkey "
        "TO transactions_account_id_fkey"
    )
    op.alter_column('transactions', 'fund_category_id', new_column_name='account_id')

    op.drop_column('transactions', 'title')

    op.drop_column('categories', 'color')

    op.drop_column('fund_categories', 'color')
    op.drop_column('fund_categories', 'icon')
    op.rename_table('fund_categories', 'accounts')
