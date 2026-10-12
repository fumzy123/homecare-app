"""Preserve historical visit evidence across scheduling edits."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "c0a4b8d5e397"
down_revision = "b9f3a7c4d286"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "billing_visit_evidence",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("shift_id", UUID(as_uuid=True), sa.ForeignKey("shifts.id"), nullable=False),
        sa.Column("occurrence_date", sa.Date(), nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("client_id", UUID(as_uuid=True), sa.ForeignKey("clients.id"), nullable=False),
        sa.Column("modification_id", UUID(as_uuid=True), nullable=True),
        sa.Column("local_start", sa.DateTime(), nullable=False),
        sa.Column("completion_status", sa.String(), nullable=False),
        sa.Column("source", sa.String(), nullable=False),
        sa.Column("recorded_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("org_id", "shift_id", "occurrence_date", "revision", name="uq_billing_visit_revision"),
        sa.CheckConstraint("revision > 0", name="ck_billing_visit_revision"),
    )
    op.create_index("ix_billing_visit_org_start", "billing_visit_evidence", ["org_id", "local_start"])


def downgrade():
    op.drop_table("billing_visit_evidence")
