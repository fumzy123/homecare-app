"""enable_rls_alembic_version

Revision ID: 144e584e476d
Revises: b48566b9bca6
Create Date: 2026-06-02 18:32:42.670982

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '144e584e476d'
down_revision: Union[str, Sequence[str], None] = 'b48566b9bca6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("ALTER TABLE alembic_version ENABLE ROW LEVEL SECURITY;")


def downgrade() -> None:
    """Downgrade schema."""
    op.execute("ALTER TABLE alembic_version DISABLE ROW LEVEL SECURITY;")
