"""Version Weekly Care Need and retain historical scheduling evidence."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql as pg

revision = '5961f453498d'
down_revision = 'c6a1d9e2f803'
branch_labels = None
depends_on = None

def upgrade():
    op.create_table('weekly_care_needs',
        sa.Column('id', pg.UUID(as_uuid=True), primary_key=True),
        sa.Column('client_id', pg.UUID(as_uuid=True), sa.ForeignKey('clients.id'), nullable=False),
        sa.Column('org_id', pg.UUID(as_uuid=True), sa.ForeignKey('organizations.id'), nullable=False),
        sa.Column('version', sa.Integer(), nullable=False),
        sa.Column('imported', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('effective_from', sa.Date(), nullable=False),
        sa.Column('scheduled_from', sa.Date()),
        sa.Column('supersedes_id', pg.UUID(as_uuid=True), sa.ForeignKey('weekly_care_needs.id')),
        sa.Column('created_by', pg.UUID(as_uuid=True), sa.ForeignKey('employments.id')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('activated_at', sa.DateTime(timezone=True)),
        sa.Column('ends_on', sa.Date()),
        sa.UniqueConstraint('client_id', 'version', name='uq_care_need_client_version'))
    op.create_index('ix_weekly_care_needs_client_id', 'weekly_care_needs', ['client_id'])
    op.create_index('ix_weekly_care_needs_org_id', 'weekly_care_needs', ['org_id'])
    op.rename_table('weekly_care_plan_entries', 'care_slots')
    op.add_column('care_slots', sa.Column('weekly_care_need_id', pg.UUID(as_uuid=True), sa.ForeignKey('weekly_care_needs.id')))
    # Version 1 is explicitly an imported baseline, not invented historical versions.
    op.execute("""
        INSERT INTO weekly_care_needs (id, client_id, org_id, version, imported, effective_from, activated_at)
        SELECT gen_random_uuid(), c.id, c.org_id, 1, true, CURRENT_DATE, now()
        FROM clients c WHERE EXISTS (SELECT 1 FROM care_slots s WHERE s.client_id=c.id)
        OR EXISTS (SELECT 1 FROM shifts s WHERE s.client_id=c.id AND s.is_recurring AND s.deleted_at IS NULL)
    """)
    op.execute('UPDATE care_slots s SET weekly_care_need_id=n.id FROM weekly_care_needs n WHERE s.client_id=n.client_id')
    op.alter_column('care_slots', 'weekly_care_need_id', nullable=False)
    op.create_index('ix_care_slots_weekly_care_need_id', 'care_slots', ['weekly_care_need_id'])
    op.add_column('shifts', sa.Column('weekly_care_need_id', pg.UUID(as_uuid=True), sa.ForeignKey('weekly_care_needs.id')))
    op.add_column('shifts', sa.Column('care_slot_id', pg.UUID(as_uuid=True), sa.ForeignKey('care_slots.id')))
    op.create_index('ix_shifts_weekly_care_need_id', 'shifts', ['weekly_care_need_id'])
    op.create_index('ix_shifts_care_slot_id', 'shifts', ['care_slot_id'])
    # Existing recurring coverage belongs to the imported schedule baseline.
    # Slot linkage remains NULL where original provenance cannot be established.
    op.execute("""UPDATE shifts s SET weekly_care_need_id=n.id FROM weekly_care_needs n
        WHERE s.client_id=n.client_id AND s.is_recurring AND s.deleted_at IS NULL""")
    op.alter_column('placements', 'care_plan_snapshot', new_column_name='care_slot_snapshot')
    op.add_column('placements', sa.Column('weekly_care_need_id', pg.UUID(as_uuid=True), sa.ForeignKey('weekly_care_needs.id')))
    op.create_unique_constraint('uq_placement_care_need', 'placements', ['weekly_care_need_id'])
    op.add_column('placement_interests', sa.Column('care_slot_ids', pg.JSONB(), nullable=False, server_default='[]'))
    op.create_table('care_slot_assignments',
        sa.Column('id', pg.UUID(as_uuid=True), primary_key=True),
        sa.Column('care_slot_id', pg.UUID(as_uuid=True), sa.ForeignKey('care_slots.id'), nullable=False, unique=True),
        sa.Column('placement_id', pg.UUID(as_uuid=True), sa.ForeignKey('placements.id'), nullable=False),
        sa.Column('employment_id', pg.UUID(as_uuid=True), sa.ForeignKey('employments.id'), nullable=False),
        sa.Column('approved_by', pg.UUID(as_uuid=True), sa.ForeignKey('employments.id'), nullable=False),
        sa.Column('starts_on', sa.Date(), nullable=False),
        sa.Column('approved_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()))
    op.create_index('ix_care_slot_assignments_placement_id', 'care_slot_assignments', ['placement_id'])
    # Preserve the retired single-worker information for audit, not authorization.
    op.execute("""CREATE TABLE legacy_client_worker_assignments AS
        SELECT id AS client_id, org_id, assigned_worker_id AS employment_id
        FROM clients WHERE assigned_worker_id IS NOT NULL""")
    op.drop_column('clients', 'assigned_worker_id')
    for table in ('weekly_care_needs', 'care_slots', 'care_slot_assignments', 'legacy_client_worker_assignments'):
        op.execute(f'ALTER TABLE {table} ENABLE ROW LEVEL SECURITY')
        op.execute(f'REVOKE ALL ON TABLE {table} FROM anon, authenticated')
    op.execute("ALTER TYPE notificationtype ADD VALUE IF NOT EXISTS 'placement_coverage_updated'")
    op.execute("ALTER TYPE notificationtype ADD VALUE IF NOT EXISTS 'placement_interest_received'")

def downgrade():
    raise RuntimeError('This migration preserves version and assignment history. Restore a pre-migration backup rather than discarding it with downgrade.')
