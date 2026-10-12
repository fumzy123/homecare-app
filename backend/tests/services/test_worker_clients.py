from datetime import date, datetime
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.routes.worker_clients import get_worker_client_service, router
from app.core.enums import EmploymentStatus, OrgMemberRole, ShiftCompletionStatus
from app.core.exceptions import AppError
from app.schemas.worker_client import WorkerClientProfile, WorkerClientSummary
from app.services.worker_client_service import WorkerClientService


def service():
    svc = WorkerClientService.__new__(WorkerClientService)
    svc.client_repo, svc.shift_repo = MagicMock(), MagicMock()
    svc.org_id, svc.worker_id = uuid4(), uuid4()
    svc.client_repo.get_for_worker.return_value = SimpleNamespace(
        id=uuid4(), first_name='Sample', last_name='Client', date_of_birth=date(1940, 1, 1),
        street='1 Example St', city='Example', medical_conditions=None,
    )
    return svc


def test_visit_history_resolves_recurrence_modifications_and_preserves_occurrence_identity():
    svc = service()
    shift = SimpleNamespace(
        id=uuid4(), start_time=datetime(2025, 1, 6, 9), end_time=datetime(2025, 1, 6, 11),
        is_recurring=True, recurrence_rule='FREQ=WEEKLY;BYDAY=MO', recurrence_end_date=date(2025, 1, 20),
        service_type=None, location=None, notes='Care instructions', modifications=[
            SimpleNamespace(id=uuid4(), original_date=date(2025, 1, 13), new_start_time=datetime(2025, 1, 13, 10),
                new_end_time=None, completion_status=ShiftCompletionStatus.completed, notes='Changed instructions'),
            SimpleNamespace(id=uuid4(), original_date=date(2025, 1, 20), new_start_time=None,
                new_end_time=None, completion_status=ShiftCompletionStatus.cancelled, notes=None),
        ],
    )
    svc.shift_repo.get_shifts_in_range.return_value = [shift]
    client_id = svc.client_repo.get_for_worker.return_value.id
    result = svc.get_client_shifts(client_id, date(2025, 1, 1), date(2025, 1, 31))
    assert [r.occurrence_date for r in result] == [date(2025, 1, 20), date(2025, 1, 13), date(2025, 1, 6)]
    assert result[0].completion_status == ShiftCompletionStatus.cancelled
    assert result[1].start_time.hour == 10 and result[1].end_time.hour == 12
    assert result[1].instructions == 'Changed instructions'
    assert all(r.shift_id == shift.id for r in result)
    svc.shift_repo.get_shifts_in_range.assert_called_once_with(
        svc.org_id, date(2025, 1, 31), worker_id=svc.worker_id, client_id=client_id,
    )


def test_hidden_client_is_rejected_before_reading_shifts():
    svc = service()
    svc.client_repo.get_for_worker.side_effect = AppError(404, 'NOT_FOUND', 'Client not found')
    with pytest.raises(AppError):
        svc.get_client_shifts(uuid4(), date(2025, 1, 1), date(2025, 1, 31))
    svc.shift_repo.get_shifts_in_range.assert_not_called()


@pytest.mark.parametrize('start,end', [(date(2025, 1, 2), date(2025, 1, 1)), (date(2025, 1, 1), date(2025, 2, 1))])
def test_history_range_is_bounded(start, end):
    svc = service()
    with pytest.raises(AppError) as error:
        svc.get_client_shifts(uuid4(), start, end)
    assert error.value.code == 'INVALID_DATE_RANGE'
    svc.shift_repo.get_shifts_in_range.assert_not_called()


@pytest.mark.parametrize('role,status', [
    (OrgMemberRole.owner, EmploymentStatus.active),
    (OrgMemberRole.home_support_worker, EmploymentStatus.terminated),
])
def test_worker_access_guard(role, status):
    with patch('app.services.worker_client_service.OrganizationRepository') as repo:
        repo.return_value.get_active_employment_for_user.return_value = SimpleNamespace(role=role, employment_status=status)
        with pytest.raises(AppError) as error:
            WorkerClientService(MagicMock(), SimpleNamespace(id=uuid4()))
        assert error.value.status_code == 403


def test_inactive_agency_is_rejected():
    with patch('app.services.worker_client_service.OrganizationRepository') as repo:
        repo.return_value.get_active_employment_for_user.return_value = SimpleNamespace(
            id=uuid4(), org_id=uuid4(), role=OrgMemberRole.home_support_worker, employment_status=EmploymentStatus.active,
        )
        repo.return_value.get_by_id.return_value = SimpleNamespace(is_active=False, deleted_at=None)
        with pytest.raises(AppError):
            WorkerClientService(MagicMock(), SimpleNamespace(id=uuid4()))


def test_api_requires_auth_and_validates_identifiers():
    app = FastAPI()
    app.include_router(router)
    client = TestClient(app)
    assert client.get('/me/clients').status_code == 401
    assert client.get(f'/me/clients/{uuid4()}').status_code == 401
    assert client.get(f'/me/clients/{uuid4()}/shifts?from_date=2025-01-01&to_date=2025-01-31').status_code == 401
    svc = MagicMock()
    app.dependency_overrides[get_worker_client_service] = lambda: svc
    assert client.get('/me/clients/not-a-uuid').status_code == 422
    assert client.get(f'/me/clients/{uuid4()}/shifts?from_date=bad&to_date=2025-01-31').status_code == 422
    svc.get_client.assert_not_called()
    svc.get_client_shifts.assert_not_called()


def test_worker_response_fields_exclude_agency_and_financial_details():
    forbidden = {'notes', 'org_id', 'care_arrangement', 'assigned_worker_id', 'email', 'authorizations'}
    assert not forbidden.intersection(WorkerClientProfile.model_fields)
    assert not {'allergies', 'medications', 'medical_conditions', 'date_of_birth'}.intersection(WorkerClientSummary.model_fields)
