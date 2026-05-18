"""flatten worker_profiles into org_members

Revision ID: c1d2e3f4a5b6
Revises: b2c3d4e5f6a7
Create Date: 2026-05-17 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision: str = 'c1d2e3f4a5b6'
down_revision: Union[str, None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add worker_profiles columns to org_members
    op.add_column('org_members', sa.Column('street', sa.String(), nullable=True))
    op.add_column('org_members', sa.Column('city', sa.String(), nullable=True))
    op.add_column('org_members', sa.Column('province', sa.String(), nullable=True))
    op.add_column('org_members', sa.Column('postal_code', sa.String(), nullable=True))
    op.add_column('org_members', sa.Column('employment_type', sa.String(), nullable=True))
    op.add_column('org_members', sa.Column('has_vehicle', sa.Boolean(), nullable=True))
    op.add_column('org_members', sa.Column('max_hours_per_week', sa.Integer(), nullable=True))
    op.add_column('org_members', sa.Column('availability', JSONB(), nullable=True))

    # Migrate existing data from worker_profiles into org_members
    op.execute("""
        UPDATE org_members om
        SET
            street             = wp.street,
            city               = wp.city,
            province           = wp.province,
            postal_code        = wp.postal_code,
            employment_type    = wp.employment_type::text,
            has_vehicle        = wp.has_vehicle,
            max_hours_per_week = wp.max_hours_per_week,
            availability       = wp.availability
        FROM worker_profiles wp
        WHERE wp.org_member_id = om.id
    """)

    # Drop the now-redundant table
    op.drop_table('worker_profiles')


def downgrade() -> None:
    # Recreate worker_profiles
    op.create_table(
        'worker_profiles',
        sa.Column('org_member_id', sa.UUID(), nullable=False),
        sa.Column('street', sa.String(), nullable=True),
        sa.Column('city', sa.String(), nullable=True),
        sa.Column('province', sa.String(), nullable=True),
        sa.Column('postal_code', sa.String(), nullable=True),
        sa.Column('employment_type', sa.String(), nullable=True),
        sa.Column('has_vehicle', sa.Boolean(), nullable=True),
        sa.Column('max_hours_per_week', sa.Integer(), nullable=True),
        sa.Column('availability', JSONB(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['org_member_id'], ['org_members.id']),
        sa.PrimaryKeyConstraint('org_member_id'),
    )

    # Move data back
    op.execute("""
        INSERT INTO worker_profiles (
            org_member_id, street, city, province, postal_code,
            employment_type, has_vehicle, max_hours_per_week, availability
        )
        SELECT id, street, city, province, postal_code,
               employment_type, has_vehicle, max_hours_per_week, availability
        FROM org_members
        WHERE street IS NOT NULL
           OR city IS NOT NULL
           OR employment_type IS NOT NULL
           OR availability IS NOT NULL
    """)

    # Remove columns from org_members
    op.drop_column('org_members', 'availability')
    op.drop_column('org_members', 'max_hours_per_week')
    op.drop_column('org_members', 'has_vehicle')
    op.drop_column('org_members', 'employment_type')
    op.drop_column('org_members', 'postal_code')
    op.drop_column('org_members', 'province')
    op.drop_column('org_members', 'city')
    op.drop_column('org_members', 'street')
