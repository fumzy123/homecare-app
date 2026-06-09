"""unified_notifications_and_placements

Revision ID: b1c2d3e4f5a6
Revises: 31936d39544c
Create Date: 2026-06-09 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b1c2d3e4f5a6'
down_revision: Union[str, Sequence[str], None] = '31936d39544c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── New enum types ────────────────────────────────────────────────────────
    op.execute("CREATE TYPE targetaudience AS ENUM ('admins_only', 'workers_only', 'all', 'individual')")
    op.execute("CREATE TYPE placementstatus AS ENUM ('open', 'filled', 'closed')")

    # ── Rename tables ─────────────────────────────────────────────────────────
    op.rename_table('admin_notifications', 'notifications')
    op.rename_table('admin_notification_reads', 'notification_reads')

    # ── Rename columns ────────────────────────────────────────────────────────
    # worker_id → about_worker_id (and make nullable for placement notifications)
    op.alter_column('notifications', 'worker_id',
                    new_column_name='about_worker_id',
                    existing_type=sa.UUID(),
                    existing_nullable=False,
                    nullable=True)

    # admin_id → recipient_id on notification_reads
    op.alter_column('notification_reads', 'admin_id',
                    new_column_name='recipient_id',
                    existing_type=sa.UUID(),
                    existing_nullable=False,
                    nullable=False)

    # ── New columns on notifications ──────────────────────────────────────────
    op.add_column('notifications', sa.Column(
        'target_audience',
        sa.Enum('admins_only', 'workers_only', 'all', 'individual',
                name='targetaudience', create_type=False),
        nullable=False,
        server_default='admins_only',
    ))
    op.add_column('notifications', sa.Column(
        'triggered_by_id', sa.UUID(), sa.ForeignKey('employments.id'), nullable=True,
    ))
    op.add_column('notifications', sa.Column(
        'about_client_id', sa.UUID(), sa.ForeignKey('clients.id'), nullable=True,
    ))
    op.add_column('notifications', sa.Column(
        'recipient_id', sa.UUID(), sa.ForeignKey('employments.id'), nullable=True,
    ))

    # Remove the server_default now that existing rows are backfilled
    op.alter_column('notifications', 'target_audience', server_default=None)

    # ── Placements ────────────────────────────────────────────────────────────
    op.create_table(
        'placements',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('org_id', sa.UUID(), nullable=False),
        sa.Column('client_id', sa.UUID(), nullable=False),
        sa.Column('created_by', sa.UUID(), nullable=False),
        sa.Column('shift_description', sa.Text(), nullable=False),
        sa.Column('requirements', sa.Text(), nullable=True),
        sa.Column('masked_location', sa.String(), nullable=False),
        sa.Column(
            'status',
            sa.Enum('open', 'filled', 'closed', name='placementstatus', create_type=False),
            nullable=False,
            server_default='open',
        ),
        sa.Column('filled_by', sa.UUID(), nullable=True),
        sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['org_id'], ['organizations.id']),
        sa.ForeignKeyConstraint(['client_id'], ['clients.id']),
        sa.ForeignKeyConstraint(['created_by'], ['employments.id']),
        sa.ForeignKeyConstraint(['filled_by'], ['employments.id']),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table(
        'placement_interests',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('placement_id', sa.UUID(), nullable=False),
        sa.Column('employment_id', sa.UUID(), nullable=False),
        sa.Column('note', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['placement_id'], ['placements.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['employment_id'], ['employments.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('placement_id', 'employment_id', name='uq_placement_interest'),
    )


def downgrade() -> None:
    op.drop_table('placement_interests')
    op.drop_table('placements')

    op.drop_column('notifications', 'recipient_id')
    op.drop_column('notifications', 'about_client_id')
    op.drop_column('notifications', 'triggered_by_id')
    op.drop_column('notifications', 'target_audience')

    op.alter_column('notification_reads', 'recipient_id',
                    new_column_name='admin_id',
                    existing_type=sa.UUID(),
                    existing_nullable=False,
                    nullable=False)

    op.alter_column('notifications', 'about_worker_id',
                    new_column_name='worker_id',
                    existing_type=sa.UUID(),
                    existing_nullable=True,
                    nullable=False)

    op.rename_table('notification_reads', 'admin_notification_reads')
    op.rename_table('notifications', 'admin_notifications')

    op.execute("DROP TYPE targetaudience")
    op.execute("DROP TYPE placementstatus")
