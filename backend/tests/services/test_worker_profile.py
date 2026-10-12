from datetime import time
from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.api.routes import worker_me
from app.core.enums import EmploymentStatus, EmploymentType, OrgMemberRole
from app.core.exceptions import AppError, app_error_handler
from app.core.security import get_current_user
from app.db.session import get_db
from app.schemas.worker_profile import WorkerProfileUpdateSchema, WorkerAvailabilityUpdateSchema
from app.services import worker_profile_service as module


@pytest.fixture
def context(monkeypatch):
    db, tasks = MagicMock(), MagicMock()
    person = SimpleNamespace(**{key: None for key in module.WorkerProfileService.PERSON_FIELDS})
    person.id, person.first_name, person.last_name, person.email = uuid4(), 'Test', 'Worker', 'test@example.com'
    employment = SimpleNamespace(
        id=uuid4(), person_id=person.id, org_id=uuid4(), role=OrgMemberRole.home_support_worker,
        employment_status=EmploymentStatus.active, employment_type=EmploymentType.part_time,
        hire_date=None, has_vehicle=None, max_hours_per_week=32, pay_rate=None,
    )
    org_repo, person_repo, availability_repo, credential_repo = [MagicMock() for _ in range(4)]
    org = SimpleNamespace(name='Test Agency', is_active=True, deleted_at=None)
    org_repo.get_active_employment_for_user.return_value = employment
    org_repo.get_by_id.return_value = org
    person_repo.get_by_id.return_value = person
    availability_repo.list_for_person.return_value = []
    for name, repo in [('OrganizationRepository', org_repo), ('PersonRepository', person_repo),
                       ('WorkerAvailabilityRepository', availability_repo), ('CredentialRepository', credential_repo)]:
        monkeypatch.setattr(module, name, lambda db, repo=repo: repo)
    user = SimpleNamespace(id=uuid4())
    return SimpleNamespace(db=db, tasks=tasks, person=person, employment=employment, org=org,
        org_repo=org_repo, person_repo=person_repo, availability_repo=availability_repo,
        credential_repo=credential_repo, user=user,
        service=lambda: module.WorkerProfileService(db, user))


def test_profile_reads_own_identity_and_real_agency(context):
    profile = context.service().get_profile()
    assert profile.id == context.employment.id
    assert profile.agency_name == 'Test Agency'
    assert profile.employment_type == EmploymentType.part_time
    context.org_repo.get_active_employment_for_user.assert_called_once_with(context.user.id)
    context.person_repo.get_by_id.assert_called_once_with(context.employment.person_id)
    context.availability_repo.list_for_person.assert_called_once_with(context.person.id)


@pytest.mark.parametrize('case', ['no_employment', 'admin', 'terminated', 'inactive_agency', 'deleted_agency'])
def test_profile_access_rejects_ineligible_identities(context, case):
    if case == 'no_employment':
        context.org_repo.get_active_employment_for_user.return_value = None
    if case == 'admin':
        context.employment.role = OrgMemberRole.manager
    if case == 'terminated':
        context.employment.employment_status = EmploymentStatus.terminated
    if case == 'inactive_agency':
        context.org.is_active = False
    if case == 'deleted_agency':
        context.org.deleted_at = 'deleted'
    with pytest.raises(AppError) as error:
        context.service()
    assert error.value.status_code == 403
    context.availability_repo.replace_for_person.assert_not_called()
    context.db.commit.assert_not_called()


def test_worker_on_leave_can_still_access_profile(context):
    context.employment.employment_status = EmploymentStatus.on_leave
    assert context.service().get_profile().employment_status == EmploymentStatus.on_leave


def test_partial_personal_update_preserves_other_sections_and_readonly_fields(context):
    context.person.emergency_contact_name = 'Keep this contact'
    profile = context.service().update_profile(WorkerProfileUpdateSchema(phone_number='555-0100'), context.tasks)
    assert profile.phone_number == '555-0100'
    assert profile.emergency_contact_name == 'Keep this contact'
    assert profile.max_hours_per_week == 32
    context.db.commit.assert_called_once()
    assert context.tasks.add_task.call_args.args[1:] == (context.employment.org_id, context.employment.id, ['phone_number'])


def test_preferences_write_to_the_correct_owner(context):
    profile = context.service().update_profile(
        WorkerProfileUpdateSchema(has_vehicle=True, languages=['English', 'French'], pet_tolerance='Cats'), context.tasks)
    assert profile.has_vehicle is True
    assert context.person.languages == ['English', 'French']
    assert not hasattr(context.person, 'has_vehicle')


@pytest.mark.parametrize('field,value', [('role', 'owner'), ('employment_status', 'active'), ('employment_type', 'full_time'),
    ('max_hours_per_week', 100), ('pay_rate', '999'), ('person_id', str(uuid4())), ('first_name', 'Change')])
def test_readonly_or_foreign_identity_fields_are_rejected(field, value):
    with pytest.raises(ValidationError):
        WorkerProfileUpdateSchema.model_validate({field: value})


def test_availability_saves_each_day_and_multiple_windows_only_for_self(context):
    payload = WorkerAvailabilityUpdateSchema.model_validate({'entries': [
        {'day_of_week': 'SU', 'start_time': '08:00', 'end_time': '12:00'},
        {'day_of_week': 'SU', 'start_time': '14:00', 'end_time': '17:00'},
        {'day_of_week': 'MO', 'start_time': '15:00', 'end_time': '23:00'},
    ]})
    context.service().update_availability(payload, context.tasks)
    person_id, entries = context.availability_repo.replace_for_person.call_args.args
    assert person_id == context.person.id
    assert all(item.person_id == person_id for item in entries)
    assert [(item.day_of_week.value, item.start_time, item.end_time) for item in entries] == [
        ('SU', time(8), time(12)), ('SU', time(14), time(17)), ('MO', time(15), time(23)),
    ]
    context.db.commit.assert_called_once()


def test_all_unavailable_is_supported(context):
    context.service().update_availability(WorkerAvailabilityUpdateSchema(entries=[]), context.tasks)
    context.availability_repo.replace_for_person.assert_called_once_with(context.person.id, [])


def test_failed_availability_save_rolls_back_without_notification(context):
    context.availability_repo.replace_for_person.side_effect = RuntimeError('Database failure')
    with pytest.raises(RuntimeError):
        context.service().update_availability(WorkerAvailabilityUpdateSchema(entries=[]), context.tasks)
    context.db.rollback.assert_called_once()
    context.db.commit.assert_not_called()
    context.tasks.add_task.assert_not_called()


@pytest.mark.parametrize('entries', [
    [{'day_of_week': 'SU', 'start_time': '17:00', 'end_time': '08:00'}],
    [{'day_of_week': 'SU', 'start_time': '08:00', 'end_time': '08:00'}],
    [{'day_of_week': 'MO', 'start_time': '24:00', 'end_time': '25:00'}],
    [{'day_of_week': 'MO', 'start_time': '08:00+02:00', 'end_time': '17:00'}],
    [{'day_of_week': 'MO', 'start_time': '08:00', 'end_time': '17:00', 'person_id': str(uuid4())}],
    [{'day_of_week': 'SU', 'start_time': '08:00', 'end_time': '17:00'},
     {'day_of_week': 'SU', 'start_time': '16:00', 'end_time': '18:00'}],
])
def test_invalid_time_windows_are_rejected(entries):
    with pytest.raises(ValidationError):
        WorkerAvailabilityUpdateSchema.model_validate({'entries': entries})


def test_http_routes_require_auth_and_reject_employment_edits(context):
    app = FastAPI()
    app.include_router(worker_me.router, prefix='/api')
    app.add_exception_handler(AppError, app_error_handler)
    app.dependency_overrides[get_db] = lambda: context.db
    client = TestClient(app)
    assert client.get('/api/me/profile').status_code == 401
    assert client.get('/api/me/credentials').status_code == 401
    assert client.patch('/api/me/availability', json={'entries': []}).status_code == 401
    app.dependency_overrides[get_current_user] = lambda: context.user
    assert client.get('/api/me/profile').json()['agency_name'] == 'Test Agency'
    assert client.patch('/api/me/profile', json={'employment_type': 'full_time'}).status_code == 422
    assert client.patch('/api/me/availability', json={'person_id': str(uuid4()), 'entries': []}).status_code == 422
    context.db.commit.assert_not_called()
