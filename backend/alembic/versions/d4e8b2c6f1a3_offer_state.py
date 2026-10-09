"""offer_state on users: the Premium offers' memory, shared by all devices

Revision ID: d4e8b2c6f1a3
Revises: c7d2f4a8e1b9
Create Date: 2026-10-09 00:00:00.000000

Additive and nullable: the older backend never reads or writes it.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'd4e8b2c6f1a3'
down_revision: Union[str, Sequence[str], None] = 'c7d2f4a8e1b9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('offer_state', postgresql.JSONB(), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'offer_state')
