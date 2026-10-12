from datetime import date, datetime, time, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from pydantic import ValidationError
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.models import Base
from app.models.activity import ActivityEvent, ActivityRead
from app.models.admin_notification import Notification, NotificationRead
from app.models.credential import Credential
from app.models.employment import Employment
from app.models.invitation import Invitation
from app.models.organization import Organization
from app.models.person import Person
from app.models.progress_note import ProgressNote
from app.models.push_delivery import PushDelivery
from app.models.push_device import PushDevice
from app.models.shift import Shift
from app.models.worker_availability import WorkerAvailabilityEntry
from app.core.enums import ComplianceDocumentType, EmploymentStatus, NotificationType, OrgMemberRole, WeekDay
from app.schemas.account_deletion import AccountDeletionPlan, RETENTION_CATEGORIES
from app.services.account_deletion_service import AccountDeletionService, DeletionReviewError


@pytest.fixture
def case():
    engine = create_engine('sqlite://')
    models = [Organization, Person, Employment, Invitation, Credential, PushDevice, PushDelivery,
              Notification, NotificationRead, ActivityEvent, ActivityRead, WorkerAvailabilityEntry,
              Shift, ProgressNote]
    Base.metadata.create_all(engine, tables=[m.__table__ for m in models])
    with Session(engine) as db:
        org = Organization(id=uuid4(), name='Fictional agency', owner_id=uuid4())
        person = Person(id=uuid4(), supabase_user_id=uuid4(), first_name='Fictional', last_name='Worker',
                        email='worker@example.test', pet_tolerance='yes', languages=['English'],
                        emergency_contact_name='Fictional contact', phone_number='555-0100')
        worker = Employment(id=uuid4(), person_id=person.id, org_id=org.id,
                            role=OrgMemberRole.home_support_worker, employment_status=EmploymentStatus.terminated,
                            deleted_at=datetime.now(timezone.utc))
        other_person = Person(id=uuid4(), supabase_user_id=uuid4(), first_name='Other', last_name='Worker',
                              email='other@example.test', pet_tolerance='yes')
        other_org = Organization(id=uuid4(), name='Other fictional agency', owner_id=uuid4())
        other_worker = Employment(id=uuid4(), person_id=other_person.id, org_id=other_org.id,
                                  role=OrgMemberRole.home_support_worker, employment_status=EmploymentStatus.active)
        device = PushDevice(id=uuid4(), worker_id=worker.id, secret_hash='a' * 64, token='ExpoPushToken[former]', app_id='test')
        other_device = PushDevice(id=uuid4(), worker_id=other_worker.id, secret_hash='b' * 64, token='ExpoPushToken[other]', app_id='test')
        note = Notification(id=uuid4(), org_id=org.id, type=NotificationType.shift_assigned, recipient_id=worker.id, payload={})
        event = ActivityEvent(id=uuid4(), org_id=org.id, actor_id=worker.id, situation_key='test', category='workers', title='History')
        shift = Shift(id=uuid4(), org_id=org.id, worker_id=worker.id, client_id=uuid4(), created_by=worker.id,
                      start_time=datetime(2026, 1, 1, 9), end_time=datetime(2026, 1, 1, 10))
        progress = ProgressNote(id=uuid4(), shift_id=shift.id, occurrence_date=date(2026, 1, 1),
                                entries=[{'time': '10:00', 'content': 'Fictional retained care note'}])
        credential = Credential(id=uuid4(), person_id=person.id, document_type=ComplianceDocumentType.first_aid_cpr,
                                file_url=f'{person.id}/first_aid_cpr.pdf')
        availability = WorkerAvailabilityEntry(person_id=person.id, day_of_week=list(WeekDay)[0],
                                                start_time=time(9), end_time=time(17))
        delivery = PushDelivery(id=uuid4(), notification_id=note.id, device_id=device.id, worker_id=worker.id,
                                org_id=org.id, app_id='test', kind='shift_assigned', token=device.token,
                                created_at=datetime.now(timezone.utc), next_attempt_at=datetime.now(timezone.utc),
                                expires_at=datetime.now(timezone.utc) + timedelta(days=1))
        db.add_all([org, person, worker, other_org, other_person, other_worker, device, other_device, note, event,
                    shift, progress, credential, availability, delivery,
                    NotificationRead(notification_id=note.id, recipient_id=worker.id),
                    ActivityRead(event_id=event.id, member_id=worker.id)])
        db.commit()
        auth = MagicMock()
        auth.get_user_by_id.return_value = SimpleNamespace(user=SimpleNamespace(id=person.supabase_user_id, email=person.email))
        plan = AccountDeletionPlan(
            person_id=person.id, expected_auth_user_id=person.supabase_user_id, expected_employment_ids=[worker.id],
            request_reference='fictional-case', operator_reference='test-operator', identity_verified=True, agency_reviewed=True,
            remove_profile_fields=['pet_tolerance', 'languages', 'emergency_contact_name'], remove_availability=True,
            retention=[{'category': c, 'reason': 'Fictional reviewed retention basis for testing only',
                        'review_on': date.today() + timedelta(days=365)} for c in sorted(RETENTION_CATEGORIES)],
        )
        yield SimpleNamespace(db=db, person=person, worker=worker, org=org, other_person=other_person,
                              other_worker=other_worker, other_device=other_device, device=device, note=note,
                              shift=shift, progress=progress, credential=credential, plan=plan, auth=auth,
                              service=AccountDeletionService(db, auth))


def execute(case, plan=None, token=None):
    plan = plan or case.plan
    token = token or case.service.preview(plan)['review_token']
    return case.service.execute(plan, token, record_phase=lambda _phase: None)


def test_preview_has_no_writes_or_auth_calls_and_does_not_print_profile_values(case):
    preview = case.service.preview(case.plan)
    assert preview['counts']['push_devices'] == 1
    assert preview['counts']['retained_credentials'] == 1
    assert 'worker@example.test' not in str(preview)
    assert '555-0100' not in str(preview)
    assert case.person.supabase_user_id == case.plan.expected_auth_user_id
    assert case.person.pet_tolerance == 'yes'
    assert not case.auth.mock_calls


def test_cleanup_preserves_care_employment_and_other_agency_records(case):
    result = execute(case)
    assert result['status'] == 'account_cleanup_completed_case_review_still_required'
    case.auth.delete_user.assert_called_once_with(str(case.plan.expected_auth_user_id), should_soft_delete=False)
    assert case.person.supabase_user_id is None
    assert case.person.pet_tolerance is None and case.person.emergency_contact_name is None
    assert case.person.phone_number == '555-0100'  # Not selected for removal.
    assert case.person.email == 'worker@example.test'
    assert case.db.query(PushDevice).one().id == case.other_device.id
    assert case.db.query(PushDelivery).count() == 0
    assert case.db.query(NotificationRead).count() == 0
    assert case.db.query(ActivityRead).count() == 0
    assert case.db.query(WorkerAvailabilityEntry).count() == 0
    assert case.db.query(ProgressNote).one().entries[0]['content'] == 'Fictional retained care note'
    assert case.db.query(Shift).one().worker_id == case.worker.id
    assert case.db.query(Credential).one().file_url.endswith('.pdf')
    assert case.db.query(Notification).count() == 1
    assert case.db.query(ActivityEvent).count() == 1
    assert case.db.query(Employment).count() == 2
    assert case.other_person.pet_tolerance == 'yes' and case.other_person.supabase_user_id


def test_email_replacement_is_explicit_and_availability_can_be_retained(case):
    plan = case.plan.model_copy(update={'replace_email': True, 'remove_availability': False})
    execute(case, plan)
    assert case.person.email == f'deleted-{case.person.id}@deleted.invalid'
    assert case.db.query(WorkerAvailabilityEntry).count() == 1


def test_reassigned_phone_is_kept_but_former_workers_delivery_token_is_removed(case):
    case.device.worker_id = case.other_worker.id
    case.device.token = 'ExpoPushToken[new-owner]'
    case.db.commit()
    execute(case)
    assert case.db.query(PushDevice).count() == 2
    assert case.device.token == 'ExpoPushToken[new-owner]'
    assert case.db.query(PushDelivery).count() == 0


def test_every_reviewed_former_membership_is_cleaned_without_removing_history(case):
    former = Employment(id=uuid4(), person_id=case.person.id, org_id=case.other_worker.org_id,
                        role=OrgMemberRole.home_support_worker, employment_status=EmploymentStatus.terminated,
                        deleted_at=datetime.now(timezone.utc))
    case.db.add(former)
    case.db.add(PushDevice(id=uuid4(), worker_id=former.id, secret_hash='c' * 64, token='ExpoPushToken[older]', app_id='test'))
    case.db.commit()
    plan = case.plan.model_copy(update={'expected_employment_ids': [case.worker.id, former.id]})
    execute(case, plan)
    assert case.db.query(Employment).count() == 3
    assert case.db.query(PushDevice).one().id == case.other_device.id


@pytest.mark.parametrize('change', ['active', 'open_terminated', 'admin', 'other_membership', 'rebound', 'owner', 'invitation'])
def test_scope_and_rehire_guards_prevent_deletion(case, change):
    if change == 'active':
        case.worker.employment_status = EmploymentStatus.active
    elif change == 'open_terminated':
        case.worker.deleted_at = None
    elif change == 'admin':
        case.worker.role = OrgMemberRole.owner
    elif change == 'other_membership':
        case.db.add(Employment(person_id=case.person.id, org_id=case.org.id, role=OrgMemberRole.home_support_worker))
    elif change == 'rebound':
        case.person.supabase_user_id = uuid4()
    elif change == 'owner':
        case.org.owner_id = case.person.supabase_user_id
    else:
        case.db.add(Invitation(email=case.person.email.upper(), role=OrgMemberRole.home_support_worker,
                               org_id=case.org.id, invited_by=case.worker.id))
    case.db.commit()
    with pytest.raises(DeletionReviewError):
        execute(case)
    case.auth.delete_user.assert_not_called()
    assert case.person.pet_tolerance == 'yes'


@pytest.mark.parametrize('field', ['identity_verified', 'agency_reviewed'])
def test_execution_needs_verified_review(case, field):
    with pytest.raises(DeletionReviewError, match='Verify identity'):
        execute(case, case.plan.model_copy(update={field: False}))
    case.auth.delete_user.assert_not_called()


def test_retention_needs_future_review_dates(case):
    case.plan.retention[0].review_on = date(2020, 1, 1)
    with pytest.raises(DeletionReviewError, match='future review'):
        execute(case)
    case.auth.delete_user.assert_not_called()


def test_stale_profile_or_changed_plan_invalidates_preview(case):
    token = case.service.preview(case.plan)['review_token']
    case.person.pet_tolerance = 'updated'
    case.db.commit()
    with pytest.raises(DeletionReviewError, match='stale'):
        execute(case, token=token)
    token = case.service.preview(case.plan)['review_token']
    with pytest.raises(DeletionReviewError, match='stale'):
        execute(case, case.plan.model_copy(update={'replace_email': True}), token)
    case.auth.delete_user.assert_not_called()


def test_auth_failure_leaves_database_untouched(case):
    case.auth.delete_user.side_effect = RuntimeError('Provider error with sensitive detail')
    with pytest.raises(DeletionReviewError, match='Auth deletion failed') as error:
        execute(case)
    assert 'sensitive' not in str(error.value)
    assert case.person.supabase_user_id == case.plan.expected_auth_user_id
    assert case.person.pet_tolerance == 'yes'
    assert case.db.query(PushDevice).count() == 2


def test_auth_identity_mismatch_stops_before_delete(case):
    case.auth.get_user_by_id.return_value.user.email = 'different@example.test'
    with pytest.raises(DeletionReviewError, match='does not match'):
        execute(case)
    case.auth.delete_user.assert_not_called()


class MissingUser(Exception):
    status = 404
    code = 'user_not_found'


def test_auth_already_deleted_can_finish_interrupted_database_cleanup(case):
    case.auth.get_user_by_id.side_effect = MissingUser()
    execute(case)
    case.auth.delete_user.assert_not_called()
    assert case.person.supabase_user_id is None


def test_generic_404_is_not_treated_as_a_deleted_account(case):
    error = RuntimeError('Gateway unavailable')
    error.status = 404
    case.auth.get_user_by_id.side_effect = error
    with pytest.raises(DeletionReviewError, match='lookup failed'):
        execute(case)
    assert case.person.supabase_user_id


def test_database_failure_after_auth_can_be_retried(case, monkeypatch):
    original_commit = case.db.commit
    monkeypatch.setattr(case.db, 'commit', MagicMock(side_effect=RuntimeError('commit failed')))
    with pytest.raises(RuntimeError, match='commit failed'):
        execute(case)
    assert case.person.supabase_user_id == case.plan.expected_auth_user_id
    assert case.person.pet_tolerance == 'yes'
    monkeypatch.setattr(case.db, 'commit', original_commit)
    case.auth.get_user_by_id.side_effect = MissingUser()
    execute(case)
    assert case.person.supabase_user_id is None


def test_receipt_failure_before_auth_prevents_any_mutation(case):
    token = case.service.preview(case.plan)['review_token']
    with pytest.raises(OSError):
        case.service.execute(case.plan, token, record_phase=MagicMock(side_effect=OSError('receipt unavailable')))
    case.auth.delete_user.assert_not_called()
    assert case.person.pet_tolerance == 'yes'


def test_unknown_profile_fields_and_missing_retention_are_rejected(case):
    data = case.plan.model_dump(mode='json')
    with pytest.raises(ValidationError):
        AccountDeletionPlan.model_validate({**data, 'remove_profile_fields': ['first_name']})
    with pytest.raises(ValidationError):
        AccountDeletionPlan.model_validate({**data, 'retention': []})
