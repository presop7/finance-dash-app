"""give every user their own editable copy of the default categories

The defaults (Food, Salary, ...) used to be shared rows (user_id NULL) that
nobody could edit, since a change would have hit every user at once. Each
user now gets their own copy; only "Unassigned" stays shared and locked
(transactions move there when their category is deleted). New accounts get
their copies at sign-up — see default_categories.py.

Revision ID: c4e8a1f7d2b3
Revises: b7c1e2d4a9f0
Create Date: 2026-09-29 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'c4e8a1f7d2b3'
down_revision: Union[str, Sequence[str], None] = 'b7c1e2d4a9f0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. A private copy of each shared default, per user — unless they
    #    already have their own category with that name and type.
    op.execute("""
        INSERT INTO categories (id, user_id, name, icon, color, type)
        SELECT gen_random_uuid(), u.id, g.name, g.icon, g.color, g.type
        FROM users u
        CROSS JOIN categories g
        WHERE g.user_id IS NULL AND g.name <> 'Unassigned'
          AND NOT EXISTS (
            SELECT 1 FROM categories c
            WHERE c.user_id = u.id AND c.name = g.name AND c.type = g.type
          )
    """)
    # 2. Point each user's transactions at their own copy.
    op.execute("""
        UPDATE transactions t
        SET category_id = mine.id
        FROM categories g, fund_categories f, categories mine
        WHERE t.category_id = g.id
          AND g.user_id IS NULL AND g.name <> 'Unassigned'
          AND f.id = t.fund_category_id
          AND mine.user_id = f.user_id AND mine.name = g.name AND mine.type = g.type
    """)
    # 3. The shared defaults are no longer used by anyone.
    op.execute("DELETE FROM categories WHERE user_id IS NULL AND name <> 'Unassigned'")


def downgrade() -> None:
    # Brings the shared defaults back; the per-user copies (possibly edited
    # by now) are left alone.
    op.execute("""
        INSERT INTO categories (id, user_id, name, icon, color, type)
        SELECT gen_random_uuid(), NULL, d.name, d.icon, d.color, d.type::category_type
        FROM (VALUES
            ('Food', 'cart-outline', '#0F6E56', 'expense'),
            ('Restaurant', 'cafe-outline', '#993C1D', 'expense'),
            ('Transport', 'car-outline', '#185FA5', 'expense'),
            ('Entertainment', 'game-controller-outline', '#854F0B', 'expense'),
            ('Other', 'ellipsis-horizontal-outline', '#5F5E5A', 'expense'),
            ('Salary', 'business-outline', '#185FA5', 'income'),
            ('Freelance', 'briefcase-outline', '#0F6E56', 'income'),
            ('Investment', 'trending-up-outline', '#854F0B', 'income'),
            ('Other', 'ellipsis-horizontal-outline', '#5F5E5A', 'income')
        ) AS d(name, icon, color, type)
        WHERE NOT EXISTS (
            SELECT 1 FROM categories c
            WHERE c.user_id IS NULL AND c.name = d.name AND c.type = d.type::category_type
        )
    """)
