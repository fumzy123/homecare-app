"""Funding cleanup with fictional records in an isolated, already-migrated DB."""
import importlib.util
import os
from datetime import date, datetime
from pathlib import Path
from uuid import uuid4

import pytest
from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session

from app.models.organization import Organization
from app.models.person import Person
from app.models.employment import Employment
from app.models.client import Client
from app.models.shift import Shift
from app.models.progress_note import ProgressNote
from app.models.activity import ActivityEvent, ActivityRead


def test_cleanup_removes_funding_without_extending_visits_or_losing_notes():
    url = os.getenv('CARE_TEST_DATABASE_URL')
    if not url:
        pytest.skip('Requires isolated PostgreSQL CARE_TEST_DATABASE_URL')
    assert make_url(url).database.endswith('_test')
    engine = create_engine(url)
    with engine.connect() as connection:
        transaction = connection.begin()
        try:
            assert 'authorizations' not in inspect(connection).get_table_names()
            # Reconstruct only the retired schema within this rollback-only test.
            connection.execute(text("CREATE TYPE carearrangement AS ENUM ('self_pay', 'funded')"))
            connection.execute(text("CREATE TYPE hoursperiod AS ENUM ('per_week', 'bi_weekly', 'per_month')"))
            connection.execute(text("ALTER TABLE clients ADD care_arrangement carearrangement DEFAULT 'funded' NOT NULL"))
            connection.execute(text('ALTER TABLE organizations ADD uses_authorizations boolean DEFAULT true NOT NULL'))
            connection.execute(text('CREATE TABLE authorizations (id uuid PRIMARY KEY, client_id uuid REFERENCES clients(id), hours_period hoursperiod)'))
            connection.execute(text('CREATE TABLE authorization_services (id uuid PRIMARY KEY, authorization_id uuid REFERENCES authorizations(id))'))
            with Session(bind=connection, join_transaction_mode='create_savepoint') as db:
                org = Organization(name='Fictional retirement test', owner_id=uuid4())
                person = Person(first_name='Sample', last_name='Worker', email=f'{uuid4()}@example.invalid')
                db.add_all([org, person])
                db.flush()
                worker = Employment(org_id=org.id, person_id=person.id, role='home_support_worker')
                client = Client(org_id=org.id, first_name='Sample', last_name='Client', date_of_birth=date(1940, 1, 1),
                    street='1 Example', city='Example', province='NL', postal_code='A1A1A1',
                    emergency_contact_name='Family', emergency_contact_phone='555', emergency_contact_relationship='Family',
                    special_instructions='Keep care instructions', notes='Keep agency notes')
                db.add_all([worker, client])
                db.flush()
                shift = Shift(org_id=org.id, client_id=client.id, worker_id=worker.id, created_by=worker.id,
                    start_time=datetime(2026, 10, 1, 9), end_time=datetime(2026, 10, 1, 11),
                    is_recurring=True, recurrence_rule='FREQ=WEEKLY;BYDAY=TH', recurrence_end_date=date(2026, 11, 1), notes='Keep shift notes')
                db.add(shift)
                db.flush()
                note = ProgressNote(shift_id=shift.id, occurrence_date=date(2026, 10, 1), entries=[{'time': '11:00', 'content': 'Keep progress note'}])
                event = ActivityEvent(org_id=org.id, actor_id=worker.id, situation_key='authorization:sample', category='authorizations', title='Retired funding event')
                retained = ActivityEvent(org_id=org.id, actor_id=worker.id, situation_key='visit:sample', category='documentation', title='Keep visit event')
                db.add_all([note, event, retained])
                db.flush()
                db.add(ActivityRead(event_id=event.id, member_id=worker.id))
                db.flush()
                auth = uuid4()
                db.execute(text("INSERT INTO authorizations VALUES (:id, :client, 'bi_weekly')"), {'id': auth, 'client': client.id})
                db.execute(text('INSERT INTO authorization_services VALUES (:id, :auth)'), {'id': uuid4(), 'auth': auth})
                db.commit()
                event_id, retained_id = event.id, retained.id
                before = (shift.start_time, shift.end_time, shift.recurrence_end_date, shift.recurrence_rule, shift.notes)
                module_path = Path(__file__).parents[2] / 'alembic/versions/c8a1a667710e_retire_client_funding_authorizations.py'
                spec = importlib.util.spec_from_file_location('retire_funding', module_path)
                migration = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(migration)
                with Operations.context(MigrationContext.configure(connection)):
                    migration.upgrade()
                db.expire_all()
                assert (shift.start_time, shift.end_time, shift.recurrence_end_date, shift.recurrence_rule, shift.notes) == before
                assert note.entries == [{'time': '11:00', 'content': 'Keep progress note'}]
                assert client.special_instructions == 'Keep care instructions' and client.notes == 'Keep agency notes'
                assert db.get(ActivityEvent, event_id) is None
                assert db.get(ActivityEvent, retained_id) is not None
                assert db.query(ActivityRead).filter_by(member_id=worker.id).count() == 0
                schema = inspect(connection)
                assert not {'authorizations', 'authorization_services'} & set(schema.get_table_names())
                assert 'care_arrangement' not in {c['name'] for c in schema.get_columns('clients')}
                assert 'uses_authorizations' not in {c['name'] for c in schema.get_columns('organizations')}
                assert not {'carearrangement', 'hoursperiod'} & {e['name'] for e in schema.get_enums()}
        finally:
            transaction.rollback()
    engine.dispose()
