"""drop category issuer issue_date is_required from credentials

Revision ID: affe909d87cf
Revises: a1b2c3d4e5f7
Create Date: 2026-05-30 15:01:26.125110

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'affe909d87cf'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column('credentials', 'category')
    op.drop_column('credentials', 'issuer')
    op.drop_column('credentials', 'issue_date')
    op.drop_column('credentials', 'is_required')


def downgrade() -> None:
    op.add_column('credentials', sa.Column('is_required', sa.BOOLEAN(), server_default=sa.text('false'), autoincrement=False, nullable=False))
    op.add_column('credentials', sa.Column('issue_date', sa.DATE(), autoincrement=False, nullable=True))
    op.add_column('credentials', sa.Column('issuer', sa.VARCHAR(), autoincrement=False, nullable=True))
    op.add_column('credentials', sa.Column('category', postgresql.ENUM('safety', 'health', 'emergency_response', 'transportation', 'eligibility', 'qualification', name='credentialcategory'), autoincrement=False, nullable=True))
