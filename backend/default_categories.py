"""The categories every new account starts with.

Each user gets their own copy of DEFAULT_CATEGORIES, so they can rename,
recolour or delete them freely. Only "Unassigned" stays shared (user_id=None)
and locked: it's where transactions go when their category is deleted.
"""

import uuid

from sqlalchemy.orm import Session

from models.category import Category, CategoryType

UNASSIGNED = "Unassigned"

DEFAULT_CATEGORIES = [
    # Expense
    {"name": "Food", "icon": "cart-outline", "color": "#0F6E56", "type": CategoryType.expense},
    {"name": "Restaurant", "icon": "cafe-outline", "color": "#993C1D", "type": CategoryType.expense},
    {"name": "Transport", "icon": "car-outline", "color": "#185FA5", "type": CategoryType.expense},
    {
        "name": "Entertainment",
        "icon": "game-controller-outline",
        "color": "#854F0B",
        "type": CategoryType.expense,
    },
    {"name": "Other", "icon": "ellipsis-horizontal-outline", "color": "#5F5E5A", "type": CategoryType.expense},
    # Income
    {"name": "Salary", "icon": "business-outline", "color": "#185FA5", "type": CategoryType.income},
    {"name": "Freelance", "icon": "briefcase-outline", "color": "#0F6E56", "type": CategoryType.income},
    {"name": "Investment", "icon": "trending-up-outline", "color": "#854F0B", "type": CategoryType.income},
    {"name": "Other", "icon": "ellipsis-horizontal-outline", "color": "#5F5E5A", "type": CategoryType.income},
]

# Shared and locked — one per type.
SHARED_CATEGORIES = [
    {"name": UNASSIGNED, "icon": "help-circle-outline", "color": "#5F5E5A", "type": t}
    for t in (CategoryType.expense, CategoryType.income)
]


# Default category names in other languages (English is the fallback).
# Keyed by the English name; types don't matter here ("Other" is the same
# word for expense and income).
TRANSLATED_NAMES: dict[str, dict[str, str]] = {
    "bg": {
        "Food": "Храна",
        "Restaurant": "Ресторанти",
        "Transport": "Транспорт",
        "Entertainment": "Забавления",
        "Other": "Други",
        "Salary": "Заплата",
        "Freelance": "Хонорари",
        "Investment": "Инвестиции",
    },
}


def language_from_header(accept_language: str | None) -> str:
    """First language code from an Accept-Language header ("bg-BG,en;q=0.8" -> "bg")."""
    if not accept_language:
        return "en"
    return accept_language.split(",")[0].split(";")[0].split("-")[0].strip().lower() or "en"


def add_default_categories(db: Session, user_id: uuid.UUID, language: str = "en") -> None:
    """Gives a new user their own editable copy of the defaults (no commit),
    named in their language when we have it."""
    names = TRANSLATED_NAMES.get(language, {})
    db.add_all(
        Category(user_id=user_id, **{**entry, "name": names.get(entry["name"], entry["name"])})
        for entry in DEFAULT_CATEGORIES
    )
