"""Store worker phone registrations, accessible through the backend only."""
from alembic import op
import sqlalchemy as sa

revision = "0ab31e782c90"
down_revision = "e02d964f8383"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("push_devices",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("secret_hash", sa.String(64), nullable=False),
        sa.Column("worker_id", sa.Uuid(), sa.ForeignKey("employments.id", ondelete="CASCADE"), nullable=False),
        sa.Column("token", sa.String(256), unique=True),
        sa.Column("app_id", sa.String(100), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_push_devices_worker_id", "push_devices", ["worker_id"])
    op.execute("ALTER TABLE public.push_devices ENABLE ROW LEVEL SECURITY")
    op.execute("REVOKE ALL ON TABLE public.push_devices FROM anon, authenticated")


def downgrade():
    op.drop_table("push_devices")
