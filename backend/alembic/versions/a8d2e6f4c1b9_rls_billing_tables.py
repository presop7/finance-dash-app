"""RLS on subscriptions and trial_claims (missed when they were created)

Revision ID: a8d2e6f4c1b9
Revises: f7c1d9e3a5b8
Create Date: 2026-10-18 00:00:00.000000

Same as every other public table: no access through Supabase's REST API
(see b7c1e2d4a9f0); only the backend, as table owner, reads them.
"""
from typing import Sequence, Union

from alembic import op

revision: str = 'a8d2e6f4c1b9'
down_revision: Union[str, Sequence[str], None] = 'f7c1d9e3a5b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute('ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY')
    op.execute('ALTER TABLE trial_claims ENABLE ROW LEVEL SECURITY')


def downgrade() -> None:
    op.execute('ALTER TABLE trial_claims DISABLE ROW LEVEL SECURITY')
    op.execute('ALTER TABLE subscriptions DISABLE ROW LEVEL SECURITY')
