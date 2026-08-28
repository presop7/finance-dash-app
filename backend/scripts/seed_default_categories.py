"""One-off script to seed the global (user_id=None) default categories.

Run with: python -m scripts.seed_default_categories
Safe to re-run — skips categories that already exist by (name, type).
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from database import SessionLocal
from models.category import Category, CategoryType

DEFAULT_CATEGORIES = [
    # Expense
    {"name": "Food", "icon": "cart-outline", "color": "#0F6E56", "type": CategoryType.expense},
    {
        "name": "Restaurant",
        "icon": "cafe-outline",
        "color": "#993C1D",
        "type": CategoryType.expense,
    },
    {"name": "Transport", "icon": "car-outline", "color": "#185FA5", "type": CategoryType.expense},
    {
        "name": "Entertainment",
        "icon": "game-controller-outline",
        "color": "#854F0B",
        "type": CategoryType.expense,
    },
    {
        "name": "Other",
        "icon": "ellipsis-horizontal-outline",
        "color": "#5F5E5A",
        "type": CategoryType.expense,
    },
    {
        "name": "Unassigned",
        "icon": "help-circle-outline",
        "color": "#5F5E5A",
        "type": CategoryType.expense,
    },
    # Income
    {
        "name": "Salary",
        "icon": "business-outline",
        "color": "#185FA5",
        "type": CategoryType.income,
    },
    {
        "name": "Freelance",
        "icon": "briefcase-outline",
        "color": "#0F6E56",
        "type": CategoryType.income,
    },
    {
        "name": "Investment",
        "icon": "trending-up-outline",
        "color": "#854F0B",
        "type": CategoryType.income,
    },
    {
        "name": "Other",
        "icon": "ellipsis-horizontal-outline",
        "color": "#5F5E5A",
        "type": CategoryType.income,
    },
    {
        "name": "Unassigned",
        "icon": "help-circle-outline",
        "color": "#5F5E5A",
        "type": CategoryType.income,
    },
]


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
