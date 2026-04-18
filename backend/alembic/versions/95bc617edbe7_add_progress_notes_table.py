"""Add progress_notes table

Revision ID: 95bc617edbe7
Revises: f3a9b2c1d8e7
Create Date: 2026-04-17 20:27:18.955744

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '95bc617edbe7'
down_revision: Union[str, Sequence[str], None] = 'f3a9b2c1d8e7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'progress_notes',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('shift_id', sa.UUID(), nullable=False),
        sa.Column('occurrence_date', sa.Date(), nullable=False),
        sa.Column('entries', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['shift_id'], ['shifts.id']),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade() -> None:
    op.drop_table('progress_notes')
