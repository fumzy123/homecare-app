"""enable_rls_persons_employments

Revision ID: 31936d39544c
Revises: f1a2b3c4d5e6
Create Date: 2026-06-05 00:26:27.615508

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '31936d39544c'
down_revision: Union[str, Sequence[str], None] = 'f1a2b3c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("ALTER TABLE persons ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE employments ENABLE ROW LEVEL SECURITY")


def downgrade() -> None:
    """Downgrade schema."""
    op.execute("ALTER TABLE employments DISABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE persons DISABLE ROW LEVEL SECURITY")
