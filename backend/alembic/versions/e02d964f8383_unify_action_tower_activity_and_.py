"""unify action tower activity and overtime requests

Revision ID: e02d964f8383
Revises: 5961f453498d
Create Date: 2026-10-02 10:13:28.929925

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB


# revision identifiers, used by Alembic.
revision: str = 'e02d964f8383'
down_revision: Union[str, Sequence[str], None] = '5961f453498d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('notifications', sa.Column('situation_key', sa.String(200)))
    op.create_index('ix_notifications_situation_key', 'notifications', ['situation_key'])
    op.execute("""UPDATE notifications SET situation_key = CASE
        WHEN type::text = 'credential_uploaded' THEN 'credential:' || about_worker_id::text || ':' || (payload->>'document_type')
        WHEN type::text = 'shift_dropped' THEN 'visit:' || (payload->>'shift_id') || ':' || (payload->>'occurrence_date')
        WHEN type::text = 'profile_updated' THEN 'worker:' || about_worker_id::text
        WHEN type::text = 'billing_payment_failed' THEN 'invoice:' || (payload->>'invoice_id')
        ELSE 'notice:' || id::text END""")
    op.execute("""UPDATE notifications n SET situation_key = 'care:' || p.weekly_care_need_id::text
        FROM placements p WHERE n.type::text = 'placement_interest_received'
        AND n.payload->>'placement_id' = p.id::text AND n.org_id = p.org_id AND p.weekly_care_need_id IS NOT NULL""")
    op.execute("UPDATE notifications SET situation_key = 'notice:' || id::text WHERE situation_key IS NULL")
    op.create_table('activity_events',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('org_id', UUID(as_uuid=True), sa.ForeignKey('organizations.id'), nullable=False),
        sa.Column('actor_id', UUID(as_uuid=True), sa.ForeignKey('employments.id')),
        sa.Column('situation_key', sa.String(200), nullable=False),
        sa.Column('category', sa.String(40), nullable=False),
        sa.Column('title', sa.Text(), nullable=False), sa.Column('detail', sa.Text(), nullable=False),
        sa.Column('target', JSONB, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False))
    op.create_index('ix_activity_org_time', 'activity_events', ['org_id', 'created_at', 'id'])
    op.create_index('ix_activity_situation', 'activity_events', ['org_id', 'situation_key', 'created_at'])
    op.create_index('ix_activity_actor', 'activity_events', ['org_id', 'actor_id', 'created_at'])
    op.create_table('activity_reads',
        sa.Column('event_id', UUID(as_uuid=True), sa.ForeignKey('activity_events.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('member_id', UUID(as_uuid=True), sa.ForeignKey('employments.id'), primary_key=True),
        sa.Column('read_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False))
    op.create_table('overtime_requests',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('org_id', UUID(as_uuid=True), sa.ForeignKey('organizations.id'), nullable=False),
        sa.Column('notification_id', UUID(as_uuid=True), sa.ForeignKey('notifications.id', ondelete='SET NULL'), unique=True),
        sa.Column('requested_by', UUID(as_uuid=True), sa.ForeignKey('employments.id')),
        sa.Column('worker_id', UUID(as_uuid=True), sa.ForeignKey('employments.id'), nullable=False),
        sa.Column('details', JSONB, nullable=False), sa.Column('status', sa.String(30), nullable=False),
        sa.Column('decided_by', UUID(as_uuid=True), sa.ForeignKey('employments.id')),
        sa.Column('decided_at', sa.DateTime(timezone=True)), sa.Column('decision_note', sa.Text()),
        sa.Column('shift_id', UUID(as_uuid=True), sa.ForeignKey('shifts.id')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False))
    op.create_index('ix_overtime_requests_org_id', 'overtime_requests', ['org_id'])
    # Preserve unknown historical decisions as reviewed, never invent approvals.
    op.execute("""INSERT INTO overtime_requests (id, org_id, notification_id, requested_by, worker_id, details, status, decided_by, decided_at, created_at)
        SELECT id, org_id, id, triggered_by_id, about_worker_id, payload,
        CASE WHEN resolved_at IS NULL THEN 'pending' ELSE 'reviewed' END, resolved_by, resolved_at, created_at
        FROM notifications WHERE type::text = 'overtime_approval_requested' AND about_worker_id IS NOT NULL""")
    for table in ('activity_events', 'activity_reads', 'overtime_requests'):
        op.execute(f'ALTER TABLE {table} ENABLE ROW LEVEL SECURITY')
        # Access is through the tenant-scoped backend, not the public Data API.
        op.execute(f"""DO $$ BEGIN
            IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN REVOKE ALL ON {table} FROM anon; END IF;
            IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN REVOKE ALL ON {table} FROM authenticated; END IF;
        END $$""")


def downgrade() -> None:
    op.drop_table('activity_reads')
    op.drop_table('activity_events')
    op.drop_table('overtime_requests')
    op.drop_index('ix_notifications_situation_key', table_name='notifications')
    op.drop_column('notifications', 'situation_key')
