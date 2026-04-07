"""rename_enum_values_to_match_python

Revision ID: 0d579be36366
Revises: 849f4c906667
Create Date: 2026-04-07

Renames PostgreSQL enum values to match the Python enum names:
  - 'admin' → 'agency_admin'
  - 'worker' → 'home_support_worker'

PostgreSQL requires new enum values to be committed before use,
so we run the ALTER TYPE outside a transaction, then update rows.
"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '0d579be36366'
down_revision: Union[str, Sequence[str], None] = '849f4c906667'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Step 1: Add new enum values outside of a transaction
    # PostgreSQL requires new enum values to be committed before they can be used
    op.execute("COMMIT")
    op.execute("ALTER TYPE orgmemberrole ADD VALUE IF NOT EXISTS 'agency_admin'")
    op.execute("ALTER TYPE orgmemberrole ADD VALUE IF NOT EXISTS 'home_support_worker'")

    # Step 2: Start a new transaction and update existing rows
    op.execute("BEGIN")
    op.execute("UPDATE org_members SET role = 'agency_admin' WHERE role = 'admin'")
    op.execute("UPDATE org_members SET role = 'home_support_worker' WHERE role = 'worker'")


def downgrade() -> None:
    # Revert data back to old values (old enum values still exist in the type)
    op.execute("UPDATE org_members SET role = 'admin' WHERE role = 'agency_admin'")
    op.execute("UPDATE org_members SET role = 'worker' WHERE role = 'home_support_worker'")
