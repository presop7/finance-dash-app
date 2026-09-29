"""push_reminders_due(): wake the backend 2 minutes before a reminder

A sleeping free Render backend needs up to a minute to wake. The scheduler
now starts calling send-due 2 minutes before a reminder time; those early
calls just wake the server (routes/push.py is_due() still sends only once the
time has come), so the reminder itself goes out on time.

Revision ID: a4d2e6f8b9c1
Revises: f3c8d1e5a7b2
Create Date: 2026-09-29 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'a4d2e6f8b9c1'
down_revision: Union[str, Sequence[str], None] = 'f3c8d1e5a7b2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _create(wake_early: str) -> None:
    op.execute(f"""
        CREATE OR REPLACE FUNCTION push_reminders_due() RETURNS boolean
        LANGUAGE sql STABLE AS $$
          SELECT EXISTS (
            SELECT 1
            FROM push_subscriptions s
            CROSS JOIN LATERAL unnest(s.times) AS t(minutes)
            -- today's reminder moment in the browser's timezone, as a real instant
            CROSS JOIN LATERAL (
              SELECT (date_trunc('day', now() AT TIME ZONE s.timezone)
                      + make_interval(mins => t.minutes)) AT TIME ZONE s.timezone AS slot
            ) d
            WHERE now() >= d.slot - interval '{wake_early}'
              AND now() < d.slot + interval '30 minutes'
              AND (s.last_sent_at IS NULL OR s.last_sent_at < d.slot)
          )
        $$
    """)


def upgrade() -> None:
    _create('2 minutes')


def downgrade() -> None:
    _create('0 minutes')
