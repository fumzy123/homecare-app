"""Preserve the Stripe usage price with each period, without rewriting history.

Revision ID: c4e9812ab760
Revises: b7f21c9064ab
"""
from alembic import op
import sqlalchemy as sa

revision = "c4e9812ab760"
down_revision = "b7f21c9064ab"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("billing_periods", sa.Column("additional_client_price_id", sa.String(), nullable=True))
    op.create_table("billing_review_requests",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("org_id", sa.Uuid(), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("period_id", sa.Uuid(), sa.ForeignKey("billing_periods.id"), nullable=False),
        sa.Column("request_id", sa.Uuid(), nullable=False),
        sa.Column("submitted_by", sa.Uuid(), nullable=False),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("response", sa.Text()),
        sa.Column("resolved_by", sa.Uuid()),
        sa.Column("resolved_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint("org_id", "request_id", name="uq_billing_review_request"))
    op.create_index("ix_billing_review_queue", "billing_review_requests", ["status", "submitted_at", "id"])
    op.create_index("ix_billing_review_period", "billing_review_requests", ["org_id", "period_id", "submitted_at"])
    op.execute("ALTER TABLE billing_review_requests ENABLE ROW LEVEL SECURITY")
    op.execute("REVOKE ALL ON billing_review_requests FROM PUBLIC, anon, authenticated")


def downgrade():
    raise RuntimeError("Billing price evidence must be retained; use a reviewed backup for rollback.")
