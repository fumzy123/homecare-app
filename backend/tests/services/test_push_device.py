from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import uuid4
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from app.models.push_device import PushDevice
from app.services.push_device_service import PushDeviceService
from app.schemas.push_device import PushDeviceRegistration, PushDeviceProof
from app.core.enums import EmploymentStatus, OrgMemberRole
from app.core.exceptions import AppError


@pytest.fixture
def service():
    engine = create_engine('sqlite://')
    PushDevice.__table__.create(engine)
    with Session(engine) as db:
        service = PushDeviceService(db, SimpleNamespace(id=uuid4()))
        service.org_repo = MagicMock()
        service.org_repo.get_active_employment_for_user.return_value = SimpleNamespace(
            id=uuid4(), org_id=uuid4(), role=OrgMemberRole.home_support_worker,
            employment_status=EmploymentStatus.active)
        service.org_repo.get_by_id.return_value = SimpleNamespace(is_active=True, deleted_at=None)
        yield service


def payload(secret='a' * 64, token='ExpoPushToken[test]'):
    return PushDeviceRegistration(secret=secret, token=token, app_id='com.homecareapp.worker.staging')


def test_registration_rotation_and_logout(service):
    id = uuid4()
    service.register(id, payload())
    device = service.push_device_repo.get_locked(id)
    assert device.worker_id == service.org_repo.get_active_employment_for_user.return_value.id
    assert device.secret_hash != 'a' * 64
    service.register(id, payload(token='ExpoPushToken[rotated]'))
    assert device.token == 'ExpoPushToken[rotated]'
    service.revoke(id, PushDeviceProof(secret='a' * 64))
    assert device.token is None
    service.revoke(id, PushDeviceProof(secret='a' * 64))


def test_other_installation_cannot_take_over_or_revoke(service):
    id = uuid4()
    service.register(id, payload())
    with pytest.raises(AppError) as exc:
        service.register(id, payload(secret='b' * 64))
    assert exc.value.status_code == 409
    service.revoke(id, PushDeviceProof(secret='b' * 64))
    assert service.push_device_repo.get_locked(id).token == 'ExpoPushToken[test]'


def test_same_phone_can_change_account_with_proof(service):
    id = uuid4()
    service.register(id, payload())
    new_worker = uuid4()
    service.org_repo.get_active_employment_for_user.return_value.id = new_worker
    service.register(id, payload())
    assert service.push_device_repo.get_locked(id).worker_id == new_worker


def test_token_cannot_be_duplicated(service):
    service.register(uuid4(), payload())
    with pytest.raises(AppError) as exc:
        service.register(uuid4(), payload())
    assert exc.value.status_code == 409
    assert service.db.query(PushDevice).count() == 1


@pytest.mark.parametrize('case', ['missing', 'admin', 'inactive', 'agency'])
def test_invalid_worker_cannot_register(service, case):
    worker = service.org_repo.get_active_employment_for_user.return_value
    if case == 'missing': service.org_repo.get_active_employment_for_user.return_value = None
    if case == 'admin': worker.role = OrgMemberRole.manager
    if case == 'inactive': worker.employment_status = EmploymentStatus.terminated
    if case == 'agency': service.org_repo.get_by_id.return_value.is_active = False
    with pytest.raises(AppError) as exc: service.register(uuid4(), payload())
    assert exc.value.status_code == 403
    assert service.db.query(PushDevice).count() == 0
