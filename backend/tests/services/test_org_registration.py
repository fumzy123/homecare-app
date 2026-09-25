import asyncio
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest
from app.core.enums import OrgMemberRole
from app.core.exceptions import AppError
from app.schemas.organization import RegisterOrganizationSchema
from app.services.org_service import OrgService


def service(confirmed=True):
    instance = OrgService(MagicMock(), SimpleNamespace(id=uuid4(), email='test@example.com', email_confirmed_at='2026-09-24' if confirmed else None))
    instance.person_repo = MagicMock()
    instance.org_repo = MagicMock()
    instance.employment_repo = MagicMock()
    instance.person_repo.get_by_supabase_user_id.return_value = None
    return instance


payload = RegisterOrganizationSchema(organization_name='Test agency', first_name='Test', last_name='Owner')


def test_unconfirmed_registration_has_no_side_effects():
    instance = service(False)
    with patch('app.services.org_service.get_supabase_client') as client:
        with pytest.raises(AppError) as error:
            asyncio.run(instance.register_organization(payload))
        assert error.value.status_code == 403
        client.assert_not_called()
    instance.db.commit.assert_not_called()


def test_owner_retry_repairs_metadata_without_duplicate_organization():
    instance = service()
    instance.person_repo.get_by_supabase_user_id.return_value = SimpleNamespace(first_name='Saved', last_name='Owner')
    org_id = uuid4()
    instance.org_repo.get_active_employment_for_user.return_value = SimpleNamespace(role=OrgMemberRole.owner, org_id=org_id)
    with patch('app.services.org_service.get_supabase_client') as client:
        result = asyncio.run(instance.register_organization(payload))
        assert result['org_id'] == str(org_id)
        assert client.return_value.auth.admin.update_user_by_id.call_args.args[1]['user_metadata']['first_name'] == 'Saved'
    instance.org_repo.add.assert_not_called()
    instance.db.commit.assert_not_called()


def test_existing_worker_cannot_register_as_owner():
    instance = service()
    instance.person_repo.get_by_supabase_user_id.return_value = SimpleNamespace(id=uuid4())
    instance.org_repo.get_active_employment_for_user.return_value = SimpleNamespace(role=OrgMemberRole.home_support_worker)
    with patch('app.services.org_service.get_supabase_client') as client:
        with pytest.raises(AppError) as error:
            asyncio.run(instance.register_organization(payload))
        assert error.value.status_code == 409
        client.assert_not_called()


def test_database_failure_does_not_delete_confirmed_identity():
    instance = service()
    instance.db.flush.side_effect = RuntimeError('database unavailable')
    with patch('app.services.org_service.get_supabase_client') as client:
        with pytest.raises(AppError):
            asyncio.run(instance.register_organization(payload))
        client.return_value.auth.admin.delete_user.assert_not_called()
    instance.db.rollback.assert_called_once()


def test_confirmed_signup_creates_owner_and_updates_auth_metadata():
    instance = service()
    with patch('app.services.org_service.get_supabase_client') as client:
        result = asyncio.run(instance.register_organization(payload))
        instance.org_repo.add.assert_called_once()
        instance.person_repo.add.assert_called_once()
        instance.db.commit.assert_called_once()
        assert instance.employment_repo.add.call_args.args[0].role == OrgMemberRole.owner
        metadata = client.return_value.auth.admin.update_user_by_id.call_args.args[1]['user_metadata']
        assert metadata['org_id'] == result['org_id']
        assert metadata['role'] == OrgMemberRole.owner.value
