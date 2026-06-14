"""backfill_authorizations_from_clients

Creates one authorization (+ a single service line) for every existing client
from their legacy columns (service_type, funding_source, care dates), so no data
is lost when those columns are dropped in a later migration. Hours are unknown
historically, so authorized_hours backfills as 0 and the authorization is flagged
in notes for an admin to review.

Idempotent: only clients that have no authorization yet are backfilled.

Revision ID: e2f3a4b5c6d7
Revises: d1e2f3a4b5c6
Create Date: 2026-06-14 00:30:00.000000

"""
from typing import Sequence, Union

from alembic import op


revision: str = 'e2f3a4b5c6d7'
down_revision: Union[str, Sequence[str], None] = 'd1e2f3a4b5c6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_BACKFILL_NOTE = ("Backfilled from legacy client fields — review funder, "
                  "authorization number, and hours.")


def upgrade() -> None:
    # 1. One authorization per client that doesn't already have one.
    op.execute(f"""
        INSERT INTO authorizations (
            id, org_id, client_id, funder, authorization_number,
            covering_start, covering_end, hours_period, notes, created_at
        )
        SELECT
            gen_random_uuid(),
            c.org_id,
            c.id,
            COALESCE(NULLIF(c.funding_source, ''), 'Unknown (backfilled)'),
            'BACKFILLED',
            c.care_start_date,
            c.care_end_date,
            'bi_weekly'::hoursperiod,
            '{_BACKFILL_NOTE}',
            now()
        FROM clients c
        WHERE c.deleted_at IS NULL
          AND NOT EXISTS (
              SELECT 1 FROM authorizations a WHERE a.client_id = c.id
          )
    """)

    # 2. A single service line per backfilled authorization, hours unknown (0).
    op.execute("""
        INSERT INTO authorization_services (id, authorization_id, service_type, authorized_hours)
        SELECT gen_random_uuid(), a.id, c.service_type, 0
        FROM authorizations a
        JOIN clients c ON c.id = a.client_id
        WHERE a.authorization_number = 'BACKFILLED'
          AND NOT EXISTS (
              SELECT 1 FROM authorization_services s WHERE s.authorization_id = a.id
          )
    """)


def downgrade() -> None:
    # Remove only the rows this migration created (service lines cascade).
    op.execute("DELETE FROM authorizations WHERE authorization_number = 'BACKFILLED'")
