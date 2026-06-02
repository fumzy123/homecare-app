"""enable_rls

Revision ID: b48566b9bca6
Revises: a3b4c5d6e7f8
Create Date: 2026-06-02 18:11:25.129349

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'b48566b9bca6'
down_revision: Union[str, Sequence[str], None] = 'a3b4c5d6e7f8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    tables = [
        "admin_notification_reads",
        "admin_notifications",
        "clients",
        "credentials",
        "invitations",
        "leave_records",
        "org_members",
        "organizations",
        "progress_notes",
        "shift_modifications",
        "shifts"
    ]
    for table in tables:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;")


def downgrade() -> None:
    """Downgrade schema."""
    tables = [
        "admin_notification_reads",
        "admin_notifications",
        "clients",
        "credentials",
        "invitations",
        "leave_records",
        "org_members",
        "organizations",
        "progress_notes",
        "shift_modifications",
        "shifts"
    ]
    for table in tables:
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY;")
