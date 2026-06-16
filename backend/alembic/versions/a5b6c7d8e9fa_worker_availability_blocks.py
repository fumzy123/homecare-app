"""worker availability as interval blocks

Replaces the coarse 4-bucket-per-day availability grid (persons.availability
JSONB) with concrete time-range rows, so a worker's availability can be compared
directly against a care block / shift. Buckets are converted to canonical ranges:
morning 06–12, afternoon 12–18, evening 18–23, overnight 00–06 (the pre-midnight
sliver of "overnight" is dropped — the grid was never that precise).

Revision ID: a5b6c7d8e9fa
Revises: f4b5c6d7e8f9
Create Date: 2026-06-16 01:00:00.000000

"""
import uuid
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, ENUM as PgEnum


revision: str = 'a5b6c7d8e9fa'
down_revision: Union[str, Sequence[str], None] = 'f4b5c6d7e8f9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


WEEKDAYS = {'MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'}
BUCKET_RANGES = {
    'morning':   ('06:00', '12:00'),
    'afternoon': ('12:00', '18:00'),
    'evening':   ('18:00', '23:00'),
    'overnight': ('00:00', '06:00'),
}


def upgrade() -> None:
    weekday = PgEnum('MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU', name='weekday', create_type=False)
    op.create_table(
        'worker_availability_blocks',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('person_id', UUID(as_uuid=True),
                  sa.ForeignKey('persons.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('day_of_week', weekday, nullable=False),
        sa.Column('start_time', sa.Time(), nullable=False),
        sa.Column('end_time', sa.Time(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.execute("ALTER TABLE worker_availability_blocks ENABLE ROW LEVEL SECURITY")

    # Backfill from the old bucket grid.
    conn = op.get_bind()
    rows = conn.execute(sa.text("SELECT id, availability FROM persons WHERE availability IS NOT NULL")).fetchall()
    insert = sa.text(
        "INSERT INTO worker_availability_blocks (id, person_id, day_of_week, start_time, end_time) "
        "VALUES (:id, :pid, CAST(:day AS weekday), CAST(:start AS time), CAST(:end AS time))"
    )
    for person_id, availability in rows:
        if not isinstance(availability, dict):
            continue
        for day, buckets in availability.items():
            if day not in WEEKDAYS or not buckets:
                continue
            for bucket in buckets:
                rng = BUCKET_RANGES.get(bucket)
                if not rng:
                    continue
                conn.execute(insert, {
                    'id': str(uuid.uuid4()), 'pid': person_id,
                    'day': day, 'start': rng[0], 'end': rng[1],
                })

    op.drop_column('persons', 'availability')


def downgrade() -> None:
    from sqlalchemy.dialects.postgresql import JSONB
    op.add_column('persons', sa.Column('availability', JSONB(), nullable=True))
    op.drop_table('worker_availability_blocks')
