"""add new org member roles: manager, supervisor, financial_officer, nurse

Revision ID: 580aedf55de6
Revises: 0d579be36366
Create Date: 2026-05-22

"""
from alembic import op

# revision identifiers, used by Alembic.
revision = '580aedf55de6'
down_revision = '28541c8cfb99'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TYPE orgmemberrole ADD VALUE IF NOT EXISTS 'manager'")
    op.execute("ALTER TYPE orgmemberrole ADD VALUE IF NOT EXISTS 'supervisor'")
    op.execute("ALTER TYPE orgmemberrole ADD VALUE IF NOT EXISTS 'financial_officer'")
    op.execute("ALTER TYPE orgmemberrole ADD VALUE IF NOT EXISTS 'nurse'")


def downgrade() -> None:
    # PostgreSQL does not support removing enum values without recreating the type.
    # Downgrade is intentionally a no-op.
    pass
