"""Set up (or update) the Supabase job that sends due web push reminders.

Every minute, Supabase's pg_cron checks push_reminders_due() inside the
database, and only when a reminder is due calls POST <API_URL>/push/send-due
through pg_net, with CRON_SECRET from backend/.env. So the backend is woken
only around reminder times and can sleep the rest of the day. Safe to re-run:
the job is replaced, not duplicated. Needs the migrations applied first.

Run from backend/: python scripts/schedule_push_cron.py https://your-api.onrender.com
"""
import sys

from sqlalchemy import create_engine, text

sys.path.insert(0, ".")
from config import settings  # noqa: E402

JOB = "send-due-push-reminders"

if len(sys.argv) != 2 or not sys.argv[1].startswith("https://"):
    sys.exit("usage: python scripts/schedule_push_cron.py https://your-api.onrender.com")
if not settings.CRON_SECRET:
    sys.exit("CRON_SECRET is not set in backend/.env")

url = sys.argv[1].rstrip("/") + "/push/send-due"
command = (
    "select net.http_post("
    f"url := '{url}', "
    "body := '{}'::jsonb, "
    f"headers := jsonb_build_object('Content-Type', 'application/json', 'X-Cron-Secret', '{settings.CRON_SECRET}'), "
    # the backend may need up to a minute to wake up
    "timeout_milliseconds := 60000) "
    "where push_reminders_due()"
)

with create_engine(settings.DATABASE_URL).begin() as conn:
    conn.execute(text("create extension if not exists pg_cron"))
    conn.execute(text("create extension if not exists pg_net"))
    conn.execute(text("select cron.schedule(:job, '* * * * *', :command)"), {"job": JOB, "command": command})
    print(f"Scheduled '{JOB}': every minute -> {url}")
