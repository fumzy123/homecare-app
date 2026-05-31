"""replace name with document_type enum on credentials

Revision ID: d27f49ca45f8
Revises: affe909d87cf
Create Date: 2026-05-30 15:11:01.035940

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd27f49ca45f8'
down_revision: Union[str, Sequence[str], None] = 'affe909d87cf'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


compliance_doc_type = sa.Enum(
    'first_aid_cpr', 'criminal_record_check', 'vulnerable_sector_check',
    'drivers_license', 'child_access_check', 'tb_test', 'immunization_record',
    'auto_insurance', 'work_permit', 'psw_certificate',
    name='compliancedocumenttype',
)


def upgrade() -> None:
    # Clear existing rows so the new NOT NULL enum column can be added cleanly.
    op.execute("TRUNCATE TABLE credentials RESTART IDENTITY CASCADE")
    op.drop_column('credentials', 'name')
    compliance_doc_type.create(op.get_bind(), checkfirst=True)
    op.add_column('credentials', sa.Column('document_type', compliance_doc_type, nullable=False))
    op.create_unique_constraint('uq_credential_member_type', 'credentials', ['org_member_id', 'document_type'])


def downgrade() -> None:
    op.drop_constraint('uq_credential_member_type', 'credentials', type_='unique')
    op.drop_column('credentials', 'document_type')
    op.execute("DROP TYPE IF EXISTS compliancedocumenttype")
    op.add_column('credentials', sa.Column('name', sa.VARCHAR(), autoincrement=False, nullable=False))
