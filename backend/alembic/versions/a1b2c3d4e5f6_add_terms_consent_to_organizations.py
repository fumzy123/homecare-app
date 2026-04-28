"""add_terms_consent_to_organizations

Revision ID: a1b2c3d4e5f6
Revises: edf8be3e0429
Create Date: 2026-04-28 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = 'edf8be3e0429'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('organizations', sa.Column('terms_accepted_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('organizations', sa.Column('terms_accepted_version', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('organizations', 'terms_accepted_version')
    op.drop_column('organizations', 'terms_accepted_at')
