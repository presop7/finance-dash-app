"""push_reminders_due(): lets the scheduler wake the backend only when needed

Supabase's pg_cron checks this every minute inside the database (cheap) and
calls POST /push/send-due only when it returns true, so the backend isn't
woken up otherwise. Must match routes/push.py is_due(): a reminder time, in
the browser's own timezone, passed less than 30 minutes ago and not sent
since.

Revision ID: f3c8d1e5a7b2
Revises: e2b7c9d4f1a6
Create Date: 2026-09-29 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'f3c8d1e5a7b2'
down_revision: Union[str, Sequence[str], None] = 'e2b7c9d4f1a6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
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
            WHERE now() >= d.slot
              AND now() < d.slot + interval '30 minutes'
              AND (s.last_sent_at IS NULL OR s.last_sent_at < d.slot)
          )
        $$
    """)


def downgrade() -> None:
    op.execute('DROP FUNCTION IF EXISTS push_reminders_due()')
