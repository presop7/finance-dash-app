"""Self-check for routes.push.is_due (when a daily reminder gets sent). Run: python test_push.py"""
import os
from datetime import datetime, timedelta, timezone

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg2://x:x@localhost/x")
os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")

from routes.push import is_due

SOFIA = "Europe/Sofia"  # UTC+3 in summer
utc = lambda h, m, day=29: datetime(2026, 9, day, h, m, tzinfo=timezone.utc)
AT_20 = [20 * 60]  # 20:00 Sofia = 17:00 UTC

assert not is_due(AT_20, SOFIA, None, utc(16, 59)), "not before the time"
assert is_due(AT_20, SOFIA, None, utc(17, 0)), "on time"
assert is_due(AT_20, SOFIA, None, utc(17, 20)), "a little late (server waking up) still sends"
assert not is_due(AT_20, SOFIA, None, utc(17, 31)), "too late: skipped, not sent hours off"
assert not is_due(AT_20, SOFIA, utc(17, 0), utc(17, 1)), "sent once, not again next minute"
assert is_due(AT_20, SOFIA, utc(17, 0, day=28), utc(17, 0)), "yesterday's send doesn't block today"
assert is_due([8 * 60, 20 * 60], SOFIA, utc(5, 0), utc(17, 2)), "second time of day after the first"
assert not is_due([], SOFIA, None, utc(17, 0)), "no times, nothing due"
# 00:10 in Tokyo is 15:10 UTC the day before
assert is_due([10], "Asia/Tokyo", None, datetime(2026, 9, 28, 15, 12, tzinfo=timezone.utc)), "other timezone"
print("push self-check passed")
