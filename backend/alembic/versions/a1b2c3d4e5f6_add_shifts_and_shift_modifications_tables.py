"""add_shifts_and_shift_modifications_tables

Revision ID: a1b2c3d4e5f6
Revises: c534e0be1f73
Create Date: 2026-04-09 12:00:00.000000

"""
from alembic import op

revision = 'a1b2c3d4e5f6'
down_revision = 'c534e0be1f73'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE shiftstatus AS ENUM ('active', 'cancelled');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
    """)

    op.execute("""
        DO $$ BEGIN
            CREATE TYPE shiftcompletionstatus AS ENUM (
                'scheduled', 'in_progress', 'completed', 'no_show', 'cancelled'
            );
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
    """)

    op.execute("""
        CREATE TABLE shifts (
            id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            org_id              UUID NOT NULL REFERENCES organizations(id),
            worker_id           UUID NOT NULL REFERENCES org_members(id),
            client_id           UUID NOT NULL REFERENCES clients(id),
            created_by          UUID NOT NULL REFERENCES org_members(id),
            start_time          TIMESTAMPTZ NOT NULL,
            end_time            TIMESTAMPTZ NOT NULL,
            is_recurring        BOOLEAN NOT NULL DEFAULT FALSE,
            recurrence_rule     TEXT,
            recurrence_end_date DATE,
            status              shiftstatus NOT NULL DEFAULT 'active',
            notes               TEXT,
            created_at          TIMESTAMPTZ DEFAULT NOW(),
            updated_at          TIMESTAMPTZ,
            deleted_at          TIMESTAMPTZ
        )
    """)

    op.execute("""
        CREATE TABLE shift_modifications (
            id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            shift_id          UUID NOT NULL REFERENCES shifts(id),
            original_date     DATE NOT NULL,
            new_start_time    TIMESTAMPTZ,
            new_end_time      TIMESTAMPTZ,
            completion_status shiftcompletionstatus NOT NULL DEFAULT 'scheduled',
            notes             TEXT,
            created_at        TIMESTAMPTZ DEFAULT NOW(),
            updated_at        TIMESTAMPTZ,
            CONSTRAINT uq_shift_modification_per_occurrence UNIQUE (shift_id, original_date)
        )
    """)

    op.execute("CREATE INDEX idx_shifts_org_start ON shifts(org_id, start_time)")
    op.execute("CREATE INDEX idx_shifts_worker_id ON shifts(worker_id)")
    op.execute("CREATE INDEX idx_shifts_client_id ON shifts(client_id)")
    op.execute("CREATE INDEX idx_shift_modifications_shift_id ON shift_modifications(shift_id)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_shift_modifications_shift_id")
    op.execute("DROP INDEX IF EXISTS idx_shifts_client_id")
    op.execute("DROP INDEX IF EXISTS idx_shifts_worker_id")
    op.execute("DROP INDEX IF EXISTS idx_shifts_org_start")
    op.execute("DROP TABLE IF EXISTS shift_modifications")
    op.execute("DROP TABLE IF EXISTS shifts")
    op.execute("DROP TYPE IF EXISTS shiftcompletionstatus")
    op.execute("DROP TYPE IF EXISTS shiftstatus")
