"""One-off script to seed the shared (user_id=None) "Unassigned" categories.

Run with: python -m scripts.seed_default_categories
Safe to re-run — skips categories that already exist by (name, type).
The regular defaults (Food, Salary, ...) are per-user copies made when an
account is created — see default_categories.py.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from database import SessionLocal
from default_categories import SHARED_CATEGORIES as DEFAULT_CATEGORIES
from models.category import Category


def seed() -> None:
    db = SessionLocal()
    try:
        created = 0
        for entry in DEFAULT_CATEGORIES:
            exists = (
                db.query(Category)
                .filter(
                    Category.user_id.is_(None),
                    Category.name == entry["name"],
                    Category.type == entry["type"],
                )
                .first()
            )
            if exists:
                continue
            db.add(Category(user_id=None, **entry))
            created += 1
        db.commit()
        print(f"Seeded {created} new default categories ({len(DEFAULT_CATEGORIES) - created} already existed).")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
