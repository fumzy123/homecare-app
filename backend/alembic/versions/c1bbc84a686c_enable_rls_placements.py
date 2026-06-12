"""enable_rls_placements

Revision ID: c1bbc84a686c
Revises: b1c2d3e4f5a6
Create Date: 2026-06-12 12:26:05.478867

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c1bbc84a686c'
down_revision: Union[str, Sequence[str], None] = 'b1c2d3e4f5a6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("ALTER TABLE placements ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE placement_interests ENABLE ROW LEVEL SECURITY")


def downgrade() -> None:
    """Downgrade schema."""
    op.execute("ALTER TABLE placement_interests DISABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE placements DISABLE ROW LEVEL SECURITY")
