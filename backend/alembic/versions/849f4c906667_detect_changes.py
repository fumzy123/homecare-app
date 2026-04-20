"""initial_schema — organizations and org_members

Revision ID: 849f4c906667
Revises:
Create Date: 2026-04-06 23:11:13.165240

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '849f4c906667'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create enum and tables via raw SQL to avoid SQLAlchemy auto-create quirks.
    # Migration 0d579be36366 will later add 'agency_admin' and 'home_support_worker'.
    op.execute("""
        CREATE TYPE orgmemberrole AS ENUM ('owner', 'admin', 'worker')
    """)

    op.execute("""
        CREATE TABLE organizations (
            id          UUID PRIMARY KEY,
            name        VARCHAR NOT NULL,
            owner_id    UUID NOT NULL,
            is_active   BOOLEAN,
            created_at  TIMESTAMPTZ DEFAULT now(),
            updated_at  TIMESTAMPTZ
        )
    """)

    op.execute("""
        CREATE TABLE org_members (
            id          UUID PRIMARY KEY,
            first_name  VARCHAR NOT NULL,
            last_name   VARCHAR NOT NULL,
            email       VARCHAR NOT NULL UNIQUE,
            role        orgmemberrole NOT NULL,
            is_active   BOOLEAN,
            org_id      UUID NOT NULL REFERENCES organizations(id),
            created_at  TIMESTAMPTZ DEFAULT now(),
            updated_at  TIMESTAMPTZ
        )
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS org_members")
    op.execute("DROP TABLE IF EXISTS organizations")
    op.execute("DROP TYPE IF EXISTS orgmemberrole")
