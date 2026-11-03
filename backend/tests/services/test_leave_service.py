"""Leave audit identity must reference agency employment, not Supabase Auth."""
from datetime import date
from types import SimpleNamespace
from uuid import uuid4

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session

from app.core.enums import OrgMemberRole
from app.core.exceptions import AppError
from app.models.organization import Organization
from app.models.person import Person
from app.models.employment import Employment
from app.models.leave_record import LeaveRecord
from app.schemas.leave_record import LeaveRecordCreateSchema, LeaveRecordResponse
from app.services.leave_service import LeaveService


@pytest.fixture
def agency():
    engine = create_engine('sqlite://')

    @event.listens_for(engine, 'connect')
    def enable_foreign_keys(connection, _):
        connection.execute('PRAGMA foreign_keys=ON')

    for model in (Organization, Person, Employment, LeaveRecord):
        model.__table__.create(engine)
    with Session(engine) as db:
        auth_id = uuid4()
        org = Organization(name='Test agency', owner_id=auth_id)
        person = Person(first_name='Test', last_name='Admin', email='admin@example.test', supabase_user_id=auth_id)
        worker = Person(first_name='Test', last_name='Worker', email='worker@example.test')
        db.add_all([org, person, worker])
        db.flush()
        member = Employment(org_id=org.id, person_id=person.id, role=OrgMemberRole.owner)
        employee = Employment(org_id=org.id, person_id=worker.id, role=OrgMemberRole.home_support_worker)
        db.add_all([member, employee])
        db.commit()
        yield db, SimpleNamespace(id=auth_id), member, employee
    engine.dispose()


def payload():
    return LeaveRecordCreateSchema(leave_type='sick', start_date=date(2026, 12, 14),
                                  end_date=date(2026, 12, 14), notes='Test absence')


def test_leave_persists_with_employment_recorder_and_round_trips(agency):
    db, user, member, worker = agency
    service = LeaveService(db, user)
    record = service.create_leave_record(worker.id, payload())
    response = LeaveRecordResponse.model_validate(record)
    assert response.recorded_by == member.id
    assert response.recorded_by != user.id
    assert response.org_id == member.org_id
    assert response.notes == 'Test absence'
    db.expire_all()
    assert [r.id for r in service.list_leave_records(worker.id, 2026)] == [record.id]
    service.delete_leave_record(worker.id, record.id)
    assert service.list_leave_records(worker.id, 2026) == []


def test_leave_rejects_worker_from_another_agency(agency):
    db, user, _, worker = agency
    other = Organization(name='Other agency', owner_id=uuid4())
    db.add(other)
    db.flush()
    worker.org_id = other.id
    db.commit()
    with pytest.raises(AppError):
        LeaveService(db, user).create_leave_record(worker.id, payload())
    assert db.query(LeaveRecord).count() == 0


def test_leave_rejects_missing_membership(agency):
    db, _, _, _ = agency
    with pytest.raises(AppError):
        LeaveService(db, SimpleNamespace(id=uuid4()))
