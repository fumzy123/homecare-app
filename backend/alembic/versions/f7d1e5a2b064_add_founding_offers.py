"""Three locked founding slots and permanent per-agency offer history."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "f7d1e5a2b064"
down_revision = "e6c0d4f1a953"
branch_labels = None
depends_on = None


def upgrade():
    slots = op.create_table(
        "founding_slots",
        sa.Column("slot_number", sa.Integer(), primary_key=True, autoincrement=False),
        sa.Column("org_id", UUID(as_uuid=True), sa.ForeignKey("organizations.id"), unique=True),
        sa.Column("consumed_at", sa.DateTime(timezone=True)),
        sa.CheckConstraint("slot_number BETWEEN 1 AND 3", name="ck_founding_slot_limit"),
    )
    op.bulk_insert(slots, [{"slot_number": number} for number in (1, 2, 3)])
    op.create_table(
        "founding_offers",
        sa.Column("org_id", UUID(as_uuid=True), sa.ForeignKey("organizations.id"), primary_key=True),
        sa.Column("slot_number", sa.Integer(), sa.ForeignKey("founding_slots.slot_number"), nullable=False),
        sa.Column("reserved_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("reserved_by", UUID(as_uuid=True), nullable=False),
        sa.Column("released_at", sa.DateTime(timezone=True)),
        sa.Column("released_by", UUID(as_uuid=True)),
        sa.Column("forfeited_at", sa.DateTime(timezone=True)),
        sa.Column("protection_starts_at", sa.DateTime(timezone=True)),
        sa.Column("protection_ends_at", sa.DateTime(timezone=True)),
    )


def downgrade():
    op.drop_table("founding_offers")
    op.drop_table("founding_slots")
