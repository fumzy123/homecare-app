"""add admin_notifications, admin_notification_reads, credential verification, and indexes

Revision ID: e1f2a3b4c5d6
Revises: d27f49ca45f8
Create Date: 2026-05-30

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = 'e1f2a3b4c5d6'
down_revision = 'd27f49ca45f8'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── 1. Create notificationtype enum ───────────────────────────────────────
    notification_type_enum = sa.Enum(
        'profile_updated', 'credential_uploaded', 'shift_dropped',
        name='notificationtype',
    )
    notification_type_enum.create(op.get_bind(), checkfirst=True)

    # ── 2. admin_notifications ────────────────────────────────────────────────
    op.create_table(
        'admin_notifications',
        sa.Column('id', UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('org_id', UUID(as_uuid=True),
                  sa.ForeignKey('organizations.id'), nullable=False),
        sa.Column('type', sa.Enum('profile_updated', 'credential_uploaded', 'shift_dropped',
                                  name='notificationtype', create_type=False), nullable=False),
        sa.Column('worker_id', UUID(as_uuid=True),
                  sa.ForeignKey('org_members.id'), nullable=False),
        sa.Column('payload', JSONB, nullable=False, server_default='{}'),
        sa.Column('requires_action', sa.Boolean, nullable=False, server_default='false'),
        sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('resolved_by', UUID(as_uuid=True),
                  sa.ForeignKey('org_members.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True),
                  server_default=sa.text('now()'), nullable=False),
    )

    # ── 3. admin_notification_reads ───────────────────────────────────────────
    op.create_table(
        'admin_notification_reads',
        sa.Column('notification_id', UUID(as_uuid=True),
                  sa.ForeignKey('admin_notifications.id', ondelete='CASCADE'),
                  nullable=False, primary_key=True),
        sa.Column('admin_id', UUID(as_uuid=True),
                  sa.ForeignKey('org_members.id'),
                  nullable=False, primary_key=True),
        sa.Column('read_at', sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint('notification_id', 'admin_id', name='uq_notification_read'),
    )

    # ── 4. Add verification columns to credentials ────────────────────────────
    op.add_column('credentials',
        sa.Column('verified_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('credentials',
        sa.Column('verified_by', UUID(as_uuid=True),
                  sa.ForeignKey('org_members.id'), nullable=True))

    # ── 5. Indexes on existing tables ─────────────────────────────────────────

    # org_members
    op.create_index('ix_org_members_org_id', 'org_members', ['org_id'])
    op.create_index('ix_org_members_org_id_role', 'org_members', ['org_id', 'role'])
    op.create_index('ix_org_members_active_org_id', 'org_members', ['org_id'],
                    postgresql_where=sa.text('deleted_at IS NULL'))

    # shifts
    op.create_index('ix_shifts_org_id', 'shifts', ['org_id'])
    op.create_index('ix_shifts_worker_id', 'shifts', ['worker_id'])
    op.create_index('ix_shifts_client_id', 'shifts', ['client_id'])
    op.create_index('ix_shifts_org_id_start_time', 'shifts', ['org_id', 'start_time'])
    op.create_index('ix_shifts_active', 'shifts', ['org_id'],
                    postgresql_where=sa.text('deleted_at IS NULL'))

    # shift_modifications
    op.create_index('ix_shift_modifications_status', 'shift_modifications',
                    ['shift_id', 'completion_status'])

    # credentials
    op.create_index('ix_credentials_expiry_date', 'credentials', ['expiry_date'])

    # clients
    op.create_index('ix_clients_org_id', 'clients', ['org_id'])
    op.create_index('ix_clients_assigned_worker_id', 'clients', ['assigned_worker_id'])
    op.create_index('ix_clients_active', 'clients', ['org_id'],
                    postgresql_where=sa.text('deleted_at IS NULL'))

    # leave_records
    op.create_index('ix_leave_records_org_id', 'leave_records', ['org_id'])
    op.create_index('ix_leave_records_worker_id', 'leave_records', ['worker_id'])
    op.create_index('ix_leave_records_worker_dates', 'leave_records',
                    ['worker_id', 'start_date', 'end_date'])

    # admin_notifications
    op.create_index('ix_admin_notifications_org_created',
                    'admin_notifications', ['org_id', 'created_at'])
    op.create_index('ix_admin_notifications_worker_id',
                    'admin_notifications', ['worker_id'])
    op.create_index('ix_admin_notifications_unresolved', 'admin_notifications', ['org_id'],
                    postgresql_where=sa.text('requires_action = true AND resolved_at IS NULL'))

    # admin_notification_reads
    op.create_index('ix_admin_notification_reads_admin_id',
                    'admin_notification_reads', ['admin_id'])
    op.create_index('ix_admin_notification_reads_unread', 'admin_notification_reads', ['admin_id'],
                    postgresql_where=sa.text('read_at IS NULL'))


def downgrade() -> None:
    # Indexes — new tables
    op.drop_index('ix_admin_notification_reads_unread', 'admin_notification_reads')
    op.drop_index('ix_admin_notification_reads_admin_id', 'admin_notification_reads')
    op.drop_index('ix_admin_notifications_unresolved', 'admin_notifications')
    op.drop_index('ix_admin_notifications_worker_id', 'admin_notifications')
    op.drop_index('ix_admin_notifications_org_created', 'admin_notifications')

    # Indexes — existing tables
    op.drop_index('ix_leave_records_worker_dates', 'leave_records')
    op.drop_index('ix_leave_records_worker_id', 'leave_records')
    op.drop_index('ix_leave_records_org_id', 'leave_records')
    op.drop_index('ix_clients_active', 'clients')
    op.drop_index('ix_clients_assigned_worker_id', 'clients')
    op.drop_index('ix_clients_org_id', 'clients')
    op.drop_index('ix_credentials_expiry_date', 'credentials')
    op.drop_index('ix_shift_modifications_status', 'shift_modifications')
    op.drop_index('ix_shifts_active', 'shifts')
    op.drop_index('ix_shifts_org_id_start_time', 'shifts')
    op.drop_index('ix_shifts_client_id', 'shifts')
    op.drop_index('ix_shifts_worker_id', 'shifts')
    op.drop_index('ix_shifts_org_id', 'shifts')
    op.drop_index('ix_org_members_active_org_id', 'org_members')
    op.drop_index('ix_org_members_org_id_role', 'org_members')
    op.drop_index('ix_org_members_org_id', 'org_members')

    # Credential verification columns
    op.drop_column('credentials', 'verified_by')
    op.drop_column('credentials', 'verified_at')

    # Tables
    op.drop_table('admin_notification_reads')
    op.drop_table('admin_notifications')

    sa.Enum(name='notificationtype').drop(op.get_bind(), checkfirst=True)
