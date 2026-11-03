"""Retain leave provenance and occurrence replacement links."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'ab731eed0142'
down_revision = '6783506efc77'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('shift_modifications', sa.Column('dropped_reason', sa.Text(), nullable=True))
    op.add_column('shift_modifications', sa.Column('replacement_shift_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key('fk_modification_replacement', 'shift_modifications', 'shifts', ['replacement_shift_id'], ['id'])


def downgrade():
    op.drop_constraint('fk_modification_replacement', 'shift_modifications', type_='foreignkey')
    op.drop_column('shift_modifications', 'replacement_shift_id')
    op.drop_column('shift_modifications', 'dropped_reason')
