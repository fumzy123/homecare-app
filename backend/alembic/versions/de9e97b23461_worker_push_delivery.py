"""worker_push_delivery

Revision ID: de9e97b23461
Revises: 0ab31e782c90
Create Date: 2026-10-03 19:31:01.395935

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'de9e97b23461'
down_revision: Union[str, Sequence[str], None] = '0ab31e782c90'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    for kind in ('shift_assigned', 'shift_updated', 'shift_cancelled'):
        op.execute(f"ALTER TYPE notificationtype ADD VALUE IF NOT EXISTS '{kind}'")
    op.create_table('push_deliveries',
        sa.Column('id', sa.Uuid(), primary_key=True),
        sa.Column('notification_id', sa.Uuid(), sa.ForeignKey('notifications.id', ondelete='CASCADE'), nullable=False),
        sa.Column('device_id', sa.Uuid(), sa.ForeignKey('push_devices.id', ondelete='CASCADE'), nullable=False),
        sa.Column('worker_id', sa.Uuid(), sa.ForeignKey('employments.id', ondelete='CASCADE'), nullable=False),
        sa.Column('org_id', sa.Uuid(), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('token', sa.String(256)),
        sa.Column('app_id', sa.String(100), nullable=False),
        sa.Column('kind', sa.String(40), nullable=False),
        sa.Column('status', sa.String(24), nullable=False),
        sa.Column('attempts', sa.Integer(), nullable=False),
        sa.Column('ticket_id', sa.String(100)),
        sa.Column('error_code', sa.String(60)),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('next_attempt_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint('notification_id', 'device_id', name='uq_push_delivery_notice_device'),
    )
    op.create_index('ix_push_deliveries_due', 'push_deliveries', ['status', 'next_attempt_at'])
    op.execute('ALTER TABLE public.push_deliveries ENABLE ROW LEVEL SECURITY')
    op.execute('REVOKE ALL ON TABLE public.push_deliveries FROM PUBLIC, anon, authenticated')


def downgrade() -> None:
    op.drop_table('push_deliveries')
    # PostgreSQL enum values stay so retained inbox history remains readable.
