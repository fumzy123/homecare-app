"""make_worker_profile_fields_nullable

Revision ID: c534e0be1f73
Revises: e7edc0d12631
Create Date: 2026-04-09 09:01:08.244650

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c534e0be1f73'
down_revision: Union[str, Sequence[str], None] = 'e7edc0d12631'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Worker profile rows are now auto-created on invite (empty).
    # Address and employment fields must be nullable until the worker fills them in.
    op.alter_column('worker_profiles', 'street', existing_type=sa.String(), nullable=True)
    op.alter_column('worker_profiles', 'city', existing_type=sa.String(), nullable=True)
    op.alter_column('worker_profiles', 'province', existing_type=sa.String(), nullable=True)
    op.alter_column('worker_profiles', 'postal_code', existing_type=sa.String(), nullable=True)
    op.alter_column('worker_profiles', 'employment_type',
                    existing_type=sa.Enum('full_time', 'part_time', 'casual', name='employmenttype'),
                    nullable=True)
    op.alter_column('worker_profiles', 'has_vehicle', existing_type=sa.Boolean(), nullable=True)


def downgrade() -> None:
    op.alter_column('worker_profiles', 'street', existing_type=sa.String(), nullable=False)
    op.alter_column('worker_profiles', 'city', existing_type=sa.String(), nullable=False)
    op.alter_column('worker_profiles', 'province', existing_type=sa.String(), nullable=False)
    op.alter_column('worker_profiles', 'postal_code', existing_type=sa.String(), nullable=False)
    op.alter_column('worker_profiles', 'employment_type',
                    existing_type=sa.Enum('full_time', 'part_time', 'casual', name='employmenttype'),
                    nullable=False)
    op.alter_column('worker_profiles', 'has_vehicle', existing_type=sa.Boolean(), nullable=False)
