"""trial_claims: which emails already had the Premium trial (hashed)

Revision ID: e5a9c3d7b2f4
Revises: d4e8b2c6f1a3
Create Date: 2026-10-09 12:00:00.000000

Additive: a new table the older backend never touches. Filled from today's
accounts, so deleting one and signing up again doesn't bring a new trial.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

from trial import email_hash

revision: str = 'e5a9c3d7b2f4'
down_revision: Union[str, Sequence[str], None] = 'd4e8b2c6f1a3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    claims = op.create_table(
        'trial_claims',
        sa.Column('email_hash', sa.String(64), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    emails = op.get_bind().execute(sa.text("SELECT email FROM users WHERE email <> ''")).scalars()
    rows = {email_hash(e) for e in emails}
    if rows:
        op.bulk_insert(claims, [{'email_hash': h} for h in rows])


def downgrade() -> None:
    op.drop_table('trial_claims')
