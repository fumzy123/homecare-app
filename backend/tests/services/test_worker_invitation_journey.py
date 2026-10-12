import asyncio
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest
from app.core.enums import EmploymentStatus, EmploymentType, OrgMemberRole
from app.core.exceptions import AppError
from app.schemas.invitation import AcceptInvitationSchema
from app.services.org_member_service import OrgMemberService
from app.services.worker_account_service import WorkerAccountService


def setup_service():
    user = SimpleNamespace(id=uuid4(), email="worker@example.com", user_metadata={
        "role": "owner", "org_id": str(uuid4()), "employment_type": "full_time",
    })
    service = OrgMemberService(MagicMock(), user)
    service.invitation_repo = MagicMock()
    service.person_repo = MagicMock()
    service.employment_repo = MagicMock()
    service.person_repo.get_by_email.return_value = None
    service.person_repo.get_by_supabase_user_id.return_value = None
    invitation = SimpleNamespace(
        org_id=uuid4(), role=OrgMemberRole.home_support_worker,
        employment_type=EmploymentType.part_time, invited_at=datetime.now(timezone.utc),
    )
    service.invitation_repo.get_pending_for_identity.return_value = invitation
    return service, invitation


payload = AcceptInvitationSchema(first_name=" Sarah ", last_name=" Worker ")


def test_acceptance_uses_saved_invitation_not_editable_metadata():
    service, invitation = setup_service()
    with patch('app.services.org_member_service.BillingAccessService'), patch('app.db.supabase.get_supabase_client'), patch('app.services.org_member_service._flat_response', return_value={}):
        asyncio.run(service.create_member(payload))
    service.invitation_repo.get_pending_for_identity.assert_called_once_with(
        service.current_user.id, service.current_user.email, lock=True,
    )
    employment = service.employment_repo.add.call_args.args[0]
    assert employment.role == OrgMemberRole.home_support_worker
    assert employment.org_id == invitation.org_id
    assert employment.employment_type == EmploymentType.part_time
    assert employment.max_hours_per_week == 24
    assert service.person_repo.add.call_args.args[0].first_name == "Sarah"
    service.db.commit.assert_called_once()


@pytest.mark.parametrize('expired', [False, True])
def test_missing_or_expired_invitation_cannot_create_membership(expired):
    service, invitation = setup_service()
    if expired:
        invitation.invited_at -= timedelta(days=2)
    else:
        service.invitation_repo.get_pending_for_identity.return_value = None
    with pytest.raises(AppError) as error:
        asyncio.run(service.create_member(payload))
    assert error.value.code == ('INVITATION_EXPIRED' if expired else 'INVITATION_NOT_FOUND')
    service.employment_repo.add.assert_not_called()
    service.db.commit.assert_not_called()


def test_acceptance_retry_returns_existing_membership_without_duplicate():
    service, _ = setup_service()
    service.invitation_repo.get_pending_for_identity.return_value = None
    service.person_repo.get_by_supabase_user_id.return_value = SimpleNamespace(id=uuid4())
    service.employment_repo.get_active_by_person_id.return_value = SimpleNamespace(employment_status=EmploymentStatus.active)
    with patch('app.services.org_member_service._flat_response', return_value={'id': 'existing'}):
        assert asyncio.run(service.create_member(payload)) == {'id': 'existing'}
    service.employment_repo.add.assert_not_called()
    service.db.commit.assert_not_called()


def test_rehire_cannot_replace_another_active_membership():
    service, _ = setup_service()
    service.person_repo.get_by_email.return_value = SimpleNamespace(id=uuid4())
    service.employment_repo.get_active_by_person_id.return_value = SimpleNamespace(org_id=uuid4())
    with patch('app.services.org_member_service.BillingAccessService'), pytest.raises(AppError) as error:
        asyncio.run(service.create_member(payload))
    assert error.value.code == 'ALREADY_REGISTERED'
    service.employment_repo.add.assert_not_called()


def account_service():
    service = WorkerAccountService(MagicMock(), SimpleNamespace(id=uuid4(), email='worker@example.com'))
    service.org_repo = MagicMock()
    service.invitation_repo = MagicMock()
    service.org_repo.get_active_employment_for_user.return_value = None
    service.invitation_repo.get_pending_for_identity.return_value = None
    return service


def test_account_resolves_agency_and_name_from_membership():
    service = account_service()
    org_id = uuid4()
    service.org_repo.get_active_employment_for_user.return_value = SimpleNamespace(
        id=uuid4(), org_id=org_id, role=OrgMemberRole.home_support_worker,
        employment_status=EmploymentStatus.active, person=SimpleNamespace(first_name='Sarah'),
    )
    service.org_repo.get_by_id.return_value = SimpleNamespace(id=org_id, name='Care Agency')
    result = service.get_account()
    assert (result['status'], result['org_name'], result['first_name']) == ('active', 'Care Agency', 'Sarah')


def test_pending_account_can_resume_but_expired_account_cannot():
    service = account_service()
    invitation = SimpleNamespace(org_id=uuid4(), role=OrgMemberRole.home_support_worker, invited_at=datetime.now(timezone.utc))
    service.invitation_repo.get_pending_for_identity.return_value = invitation
    assert service.get_account()['status'] == 'pending'
    invitation.invited_at -= timedelta(days=2)
    assert service.get_account()['status'] == 'expired'


def test_account_without_membership_does_not_expose_agency():
    assert account_service().get_account() == {'status': 'no_access', 'email': 'worker@example.com'}


def test_inactive_worker_cannot_enter_app():
    service = account_service()
    service.org_repo.get_active_employment_for_user.return_value = SimpleNamespace(employment_status=EmploymentStatus.on_leave)
    assert service.get_account()['status'] == 'no_access'


def test_invitation_repository_matches_both_identity_and_email():
    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session
    from app.models.invitation import Invitation
    from app.repositories.invitation_repository import InvitationRepository

    engine = create_engine('sqlite:///:memory:')
    Invitation.__table__.create(engine)
    user_id = uuid4()
    with Session(engine) as db:
        invite = Invitation(
            email='Worker@Example.com', supabase_user_id=user_id,
            org_id=uuid4(), invited_by=uuid4(), role=OrgMemberRole.home_support_worker,
        )
        db.add(invite)
        db.commit()
        repo = InvitationRepository(db)
        assert repo.get_pending_for_identity(user_id, 'worker@example.com') is invite
        assert repo.get_pending_for_identity(uuid4(), 'worker@example.com') is None
        assert repo.get_pending_for_identity(user_id, 'someone-else@example.com') is None
    engine.dispose()
