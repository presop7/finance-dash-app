"""enable row level security on all public tables

Supabase exposes the public schema over its REST API (PostgREST) to anyone
holding the anon key — which ships inside the mobile app. With RLS off, that
key could read/write every user's rows directly, bypassing this backend.
RLS on with no policies denies the anon/authenticated roles entirely; the
backend connects as the table owner (postgres), which bypasses RLS.

Revision ID: b7c1e2d4a9f0
Revises: 09445565a607
Create Date: 2026-09-28 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'b7c1e2d4a9f0'
down_revision: Union[str, Sequence[str], None] = '09445565a607'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLES = ['users', 'fund_categories', 'categories', 'transactions', 'alembic_version']


def upgrade() -> None:
    for table in TABLES:
        op.execute(f'ALTER TABLE {table} ENABLE ROW LEVEL SECURITY')


def downgrade() -> None:
    for table in TABLES:
        op.execute(f'ALTER TABLE {table} DISABLE ROW LEVEL SECURITY')
