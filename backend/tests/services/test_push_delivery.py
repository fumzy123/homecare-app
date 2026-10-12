from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import uuid4
import httpx
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from app.models import Base
from app.models.organization import Organization
from app.models.employment import Employment
from app.models.push_device import PushDevice
from app.models.push_delivery import PushDelivery
from app.models.admin_notification import Notification, NotificationRead
from app.models.shift import Shift
from app.models.shift_modification import ShiftModification
from app.models.activity import ActivityEvent
from app.core.enums import OrgMemberRole, EmploymentStatus
from app.domain.push import push_message, schedule_snapshot
from app.services.worker_notification_service import WorkerNotificationService
from app.services.push_delivery_service import PushDeliveryService
from app.services.expo_push_client import ExpoPushClient, PushResult

APP = 'com.homecareapp.worker.staging'


@pytest.fixture
def setup():
    engine = create_engine('sqlite://')
    Base.metadata.create_all(engine, tables=[Organization.__table__, Employment.__table__,
        PushDevice.__table__, Notification.__table__, NotificationRead.__table__, PushDelivery.__table__,
        Shift.__table__, ShiftModification.__table__, ActivityEvent.__table__])
    with Session(engine) as db:
        org = Organization(id=uuid4(), name='Fictional agency', owner_id=uuid4())
        worker = Employment(id=uuid4(), org_id=org.id, person_id=uuid4(),
                            role=OrgMemberRole.home_support_worker, employment_status=EmploymentStatus.active)
        device = PushDevice(id=uuid4(), worker_id=worker.id, secret_hash='a' * 64,
                            token='ExpoPushToken[fictional]', app_id=APP)
        db.add_all([org, worker, device])
        db.commit()
        service = WorkerNotificationService(db, org.id, worker.id)
        client = MagicMock()
        client.send.return_value = PushResult('receipt', ticket_id='ticket')
        client.receipt.return_value = PushResult('delivered')
        yield SimpleNamespace(db=db, org=org, worker=worker, device=device, service=service,
                              sender=PushDeliveryService(db, client, [APP]), client=client)


def enqueue(s):
    s.service.schedule('shift_assigned', s.worker.id, uuid4(), '2026-10-03')
    s.db.commit()
    return s.db.query(PushDelivery).one()


def test_inbox_and_delivery_roll_back_together(setup):
    s = setup
    s.service.schedule('shift_assigned', s.worker.id, uuid4())
    assert s.db.query(PushDelivery).count() == 1
    assert s.db.query(NotificationRead).count() == 1
    s.db.rollback()
    assert s.db.query(Notification).count() == 0
    assert s.db.query(PushDelivery).count() == 0
    s.client.send.assert_not_called()


def test_ticket_then_receipt_does_not_send_twice(setup):
    s = setup
    row = enqueue(s)
    assert s.sender.deliver_one()
    assert row.status == 'receipt'
    assert not s.sender.deliver_one()
    now = datetime.now(timezone.utc) + timedelta(minutes=16)
    s.client.receipt.return_value = PushResult('pending')
    assert s.sender.deliver_one(now)
    assert row.status == 'receipt'
    s.client.receipt.return_value = PushResult('delivered')
    assert s.sender.deliver_one(now + timedelta(minutes=16))
    assert row.status == 'delivered' and row.token is None
    s.client.send.assert_called_once()


@pytest.mark.parametrize('change', ['logout', 'reassign', 'rotate', 'terminated', 'deleted', 'agency', 'foreign_org'])
def test_changed_registration_or_access_is_not_sent(setup, change):
    s = setup
    row = enqueue(s)
    if change == 'logout':
        s.device.token = None
    elif change == 'reassign':
        s.device.worker_id = uuid4()
    elif change == 'rotate':
        s.device.token = 'ExpoPushToken[new]'
    elif change == 'terminated':
        s.worker.employment_status = EmploymentStatus.terminated
    elif change == 'deleted':
        s.worker.deleted_at = datetime.now(timezone.utc)
    elif change == 'agency':
        s.org.is_active = False
    else:
        s.worker.org_id = uuid4()
    s.db.commit()
    assert s.sender.deliver_one()
    assert row.status == 'skipped' and row.token is None
    s.client.send.assert_not_called()


def test_wrong_environment_never_sends(setup):
    s = setup
    enqueue(s)
    s.sender.app_ids = ['com.homecareapp.worker']
    assert not s.sender.deliver_one()
    s.client.send.assert_not_called()


def test_device_not_registered_removes_invalid_token(setup):
    s = setup
    row = enqueue(s)
    s.sender.deliver_one()
    s.client.receipt.return_value = PushResult('failed', code='DeviceNotRegistered')
    s.sender.deliver_one(datetime.now(timezone.utc) + timedelta(minutes=16))
    assert row.status == 'failed'
    assert s.device.token is None


def test_old_receipt_cannot_revoke_rotated_token(setup):
    s = setup
    row = enqueue(s)
    s.sender.deliver_one()
    s.device.token = 'ExpoPushToken[new]'
    s.db.commit()
    s.client.receipt.return_value = PushResult('failed', code='DeviceNotRegistered')
    s.sender.deliver_one(datetime.now(timezone.utc) + timedelta(minutes=16))
    assert row.status == 'skipped' and s.device.token == 'ExpoPushToken[new]'
    s.client.receipt.assert_not_called()


def test_bounded_retries_and_expiration(setup):
    s = setup
    row = enqueue(s)
    s.client.send.return_value = PushResult('retry', code='provider_unavailable')
    now = datetime.now(timezone.utc)
    for i in range(5):
        s.sender.deliver_one(now + timedelta(hours=i))
    assert row.status == 'failed' and row.attempts == 5 and row.token is None


def test_old_queued_work_expires_without_delivery(setup):
    s = setup
    row = enqueue(s)
    s.sender.deliver_one(datetime.now(timezone.utc) + timedelta(days=2))
    assert row.status == 'expired'
    s.client.send.assert_not_called()


def test_no_phone_still_gets_inbox_and_foreign_org_never_gets_push(setup):
    s = setup
    s.device.token = None
    s.db.commit()
    s.service.schedule('shift_updated', s.worker.id)
    s.db.commit()
    assert s.db.query(NotificationRead).count() == 1
    assert s.db.query(PushDelivery).count() == 0
    s.device.token = 'ExpoPushToken[fictional]'
    s.db.commit()
    WorkerNotificationService(s.db, uuid4(), s.worker.id).schedule('shift_assigned', s.worker.id)
    s.db.commit()
    assert s.db.query(PushDelivery).count() == 0


def test_payload_is_allowlisted_and_patient_free(setup):
    s = setup
    row = enqueue(s)
    notice = s.db.query(Notification).one()
    notice.payload = {'patient_name': 'Never transmit', 'message': 'Private care instructions'}
    message = push_message(row)
    assert 'Never transmit' not in str(message) and 'Private care' not in str(message)
    assert set(message['data']) == {'notification_id'}
    assert message['to'] == s.device.token


def test_reassignment_notifies_old_and_new_worker_noop_silent(setup):
    s = setup
    shift = SimpleNamespace(id=uuid4(), worker_id=s.worker.id)
    before = schedule_snapshot(shift)
    s.service.changed(before, shift)
    assert s.db.query(Notification).count() == 0
    shift.worker_id = uuid4()
    s.service.changed(before, shift)
    notices = s.db.query(Notification).all()
    assert {(n.type.value, n.recipient_id) for n in notices} == {
        ('shift_cancelled', s.worker.id), ('shift_assigned', shift.worker_id)}


@pytest.mark.parametrize('status,body,expected', [
    (200, {'data': [{'status': 'ok', 'id': 'ticket'}]}, 'receipt'),
    (429, {}, 'retry'), (503, {}, 'retry'), (401, {}, 'failed'),
    (200, {'data': [{'status': 'error', 'details': {'error': 'DeviceNotRegistered'}}]}, 'failed'),
    (200, {'data': [{'status': 'error', 'details': {'error': 'MessageRateExceeded'}}]}, 'retry'),
    (200, {'data': []}, 'retry'), (200, {'errors': [{'message': 'private'}]}, 'retry'),
])
def test_expo_boundary(status, body, expected):
    def handle(request):
        assert request.headers['Authorization'] == 'Bearer fictional'
        return httpx.Response(status, json=body)
    with httpx.Client(transport=httpx.MockTransport(handle)) as http:
        client = ExpoPushClient('fictional', http)
        result = client.send({'to': 'ExpoPushToken[test]'})
        assert result.status == expected and 'private' not in str(result)


def test_provider_timeout_and_missing_receipt():
    def timeout(_):
        raise httpx.ReadTimeout('must never store request token')
    with httpx.Client(transport=httpx.MockTransport(timeout)) as http:
        assert ExpoPushClient(client=http).send({}).status == 'retry'
    with httpx.Client(transport=httpx.MockTransport(lambda _: httpx.Response(200, json={'data': {}}))) as http:
        assert ExpoPushClient(client=http).receipt('ticket').status == 'pending'


def shift_service(s):
    from app.services.shift_service import ShiftService
    from app.repositories.shift_repository import ShiftRepository, ShiftModificationRepository
    service = ShiftService.__new__(ShiftService)
    service.db, service.org_id, service.current_employment_id = s.db, s.org.id, s.worker.id
    service.shift_repo = ShiftRepository(s.db)
    service.modification_repo = ShiftModificationRepository(s.db)
    service.cutoff_service = MagicMock()
    service.evidence_service = MagicMock()
    service._validate_shift_participants = MagicMock(return_value=SimpleNamespace(
        street='Fictional', city='Fictional', province='NL', postal_code='A1A1A1', first_name='Test', last_name='Client'))
    service._get_active_shift = lambda id: s.db.get(Shift, id)
    service._enforce_scheduling_rules = MagicMock()
    return service


def create_visit(s, service, commit=True):
    import asyncio
    from app.schemas.shift import ShiftCreateSchema
    return asyncio.run(service.create_shift(ShiftCreateSchema(
        client_id=uuid4(), worker_id=s.worker.id,
        start_time=datetime(2090, 1, 2, 9), end_time=datetime(2090, 1, 2, 11)), commit=commit))


def test_real_shift_creation_and_outbox_share_transaction(setup):
    s = setup
    service = shift_service(s)
    create_visit(s, service, commit=False)
    assert s.db.query(Shift).count() == 1
    assert s.db.query(PushDelivery).count() == 1
    s.db.rollback()
    assert s.db.query(Shift).count() == 0
    assert s.db.query(Notification).count() == 0
    assert s.db.query(PushDelivery).count() == 0


@pytest.mark.parametrize('action,kind', [('edit', 'shift_updated'), ('cancel', 'shift_cancelled'), ('occurrence', 'shift_cancelled')])
def test_saved_schedule_changes_create_correct_worker_delivery(setup, action, kind):
    import asyncio
    from app.schemas.shift import ShiftUpdateSchema, ShiftCancelSchema, ShiftModificationCreateSchema
    s = setup
    service = shift_service(s)
    shift = create_visit(s, service)
    if action == 'edit':
        asyncio.run(service.update_shift(shift.id, ShiftUpdateSchema(notes='Private patient detail')))
    elif action == 'cancel':
        asyncio.run(service.cancel_shift(shift.id, ShiftCancelSchema()))
    else:
        asyncio.run(service.create_modification(shift.id, ShiftModificationCreateSchema(
            original_date=shift.start_time.date(), completion_status='cancelled')))
    deliveries = s.db.query(PushDelivery).all()
    assert sorted(d.kind for d in deliveries) == sorted(['shift_assigned', kind])
    assert all(d.worker_id == s.worker.id for d in deliveries)
    assert 'Private patient detail' not in str([push_message(d) for d in deliveries])


def test_failed_schedule_save_never_notifies(setup):
    import asyncio
    from app.schemas.shift import ShiftUpdateSchema
    from app.core.exceptions import AppError
    s = setup
    service = shift_service(s)
    shift = create_visit(s, service)
    service._enforce_scheduling_rules.side_effect = AppError(409, 'CONFLICT', 'Conflict')
    with pytest.raises(AppError):
        asyncio.run(service.update_shift(shift.id, ShiftUpdateSchema(start_time=datetime(2090, 1, 2, 10))))
    assert s.db.query(Notification).count() == 1
    assert s.db.query(PushDelivery).count() == 1
    assert shift.start_time == datetime(2090, 1, 2, 9)
