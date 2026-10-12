"""Retain ended care-slot assignments and link their scheduled series.

Revision ID: b7f21c9064ab
Revises: de9e97b23461
"""
from alembic import op
import sqlalchemy as sa

revision = 'b7f21c9064ab'
down_revision = 'de9e97b23461'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('care_slot_assignments', sa.Column('ends_before', sa.Date()))
    op.add_column('care_slot_assignments', sa.Column('ended_at', sa.DateTime(timezone=True)))
    op.add_column('care_slot_assignments', sa.Column('ended_by', sa.Uuid(), sa.ForeignKey('employments.id')))
    op.add_column('care_slot_assignments', sa.Column('end_reason', sa.Text()))
    # PostgreSQL's default name for the unique column created by 5961f453498d.
    op.drop_constraint('care_slot_assignments_care_slot_id_key', 'care_slot_assignments', type_='unique')
    op.create_index('ix_care_slot_assignments_care_slot_id', 'care_slot_assignments', ['care_slot_id'])
    op.create_index('uq_care_slot_open_assignment', 'care_slot_assignments', ['care_slot_id'], unique=True,
                    postgresql_where=sa.text('ends_before IS NULL'))
    op.create_check_constraint('ck_assignment_dates', 'care_slot_assignments', 'ends_before IS NULL OR ends_before >= starts_on')
    op.add_column('shifts', sa.Column('assignment_id', sa.Uuid(), sa.ForeignKey('care_slot_assignments.id')))
    op.create_index('ix_shifts_assignment_id', 'shifts', ['assignment_id'])
    op.execute('''UPDATE shifts s SET assignment_id = a.id FROM care_slot_assignments a
                  WHERE s.care_slot_id = a.care_slot_id AND s.worker_id = a.employment_id''')


def downgrade():
    raise RuntimeError('This migration preserves assignment history. Restore a reviewed pre-migration backup rather than discarding it with downgrade.')
