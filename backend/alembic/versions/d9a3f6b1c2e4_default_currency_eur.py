"""new users default to EUR instead of BGN

Bulgaria adopted the euro in 2026. Only changes the default for new rows;
existing users keep whatever currency they chose.

Revision ID: d9a3f6b1c2e4
Revises: c4e8a1f7d2b3
Create Date: 2026-09-29 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'd9a3f6b1c2e4'
down_revision: Union[str, Sequence[str], None] = 'c4e8a1f7d2b3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column('users', 'currency', server_default='EUR')


def downgrade() -> None:
    op.alter_column('users', 'currency', server_default='BGN')
