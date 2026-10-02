import asyncio
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from fastapi import FastAPI, APIRouter, Depends
from fastapi.testclient import TestClient

from app.api.billing_access import require_operational_access, get_billing_access_service
from app.api.api import router as api_router
from app.core.exceptions import AppError, app_error_handler
from app.domain.billing_access import billing_access
from app.services.billing_access_service import BillingAccessService
from app.services.org_member_service import OrgMemberService

NOW = datetime(2026, 9, 28, tzinfo=timezone.utc)


def agency(**changes):
    values = dict(id=uuid4(), created_at=NOW - timedelta(days=60), onboarding_deadline_at=NOW - timedelta(days=30),
        trial_starts_at=NOW - timedelta(days=14), trial_ends_at=NOW,
        subscription_status='trialing', deleted_at=None, is_active=True)
    return SimpleNamespace(**(values | changes))


@pytest.mark.parametrize('status,allowed', [('active', True), ('past_due', False), ('unpaid', False),
    ('canceled', False), ('paused', False), ('incomplete', False), ('incomplete_expired', False), ('trialing', False), (None, False)])
def test_expired_trial_status_policy(status, allowed):
    assert billing_access(agency(subscription_status=status), NOW).can_write is allowed


def test_onboarding_trial_boundaries_legacy_and_cancel_at_period_end():
    org = agency(created_at=NOW - timedelta(days=14), onboarding_deadline_at=NOW + timedelta(days=30), trial_starts_at=None, trial_ends_at=None, subscription_status=None)
    assert billing_access(org, NOW - timedelta(seconds=1)).can_write
    assert not billing_access(org, NOW).can_write
    org = agency()
    assert billing_access(org, NOW - timedelta(seconds=1)).can_write
    assert not billing_access(org, NOW).can_write
    org = agency(onboarding_deadline_at=None, created_at=NOW - timedelta(days=14))
    assert not billing_access(org, NOW).can_write
    assert billing_access(org, NOW - timedelta(seconds=1)).can_write
    # A canceled renewal stays active in Stripe until its paid month/year ends.
    org = agency(subscription_status='active', subscription_current_period_end=NOW + timedelta(days=300))
    assert billing_access(org, NOW).can_write
    org.subscription_status = 'canceled'
    assert not billing_access(org, NOW).can_write
    org.subscription_status = 'active'
    org.deleted_at = NOW
    assert not billing_access(org, NOW).can_write


def test_naive_database_dates_are_normalized():
    org = agency(onboarding_deadline_at=None, created_at=NOW.replace(tzinfo=None), subscription_status=None)
    assert billing_access(org, NOW).can_write


def test_access_resolves_database_membership_not_user_metadata():
    user = SimpleNamespace(id=uuid4(), user_metadata={'org_id': 'paid-other-agency', 'role': 'owner'})
    service = BillingAccessService(MagicMock(), user)
    service.org_repo = MagicMock()
    org = agency(subscription_status='unpaid')
    service.org_repo.get_active_employment_for_user.return_value = SimpleNamespace(org_id=org.id)
    service.org_repo.get_by_id.return_value = org
    with pytest.raises(AppError) as error:
        service.require_write()
    assert error.value.code == 'BILLING_READ_ONLY'
    service.org_repo.get_by_id.assert_called_once_with(org.id)


def test_guard_blocks_all_mutation_methods_before_handler_but_allows_reads_and_exceptions():
    app = FastAPI()
    app.add_exception_handler(AppError, app_error_handler)
    operational = APIRouter(prefix='/api', dependencies=[Depends(require_operational_access)])
    calls = []

    def handler():
        calls.append(True)
        return {'ok': True}

    operational.add_api_route('/activity/read', handler, methods=['PATCH'])
    operational.add_api_route('/clients', handler, methods=['GET', 'POST', 'PATCH', 'PUT', 'DELETE'])
    operational.add_api_route('/organization', handler, methods=['POST', 'DELETE'])
    operational.add_api_route('/org-members', handler, methods=['POST'])
    operational.add_api_route('/notifications/{notification_id}/read', handler, methods=['PATCH'])
    operational.add_api_route('/notifications/{notification_id}/resolve', handler, methods=['PATCH'])
    app.include_router(operational)
    service = MagicMock()
    service.require_write.side_effect = AppError(403, 'BILLING_READ_ONLY', 'Read only')
    app.dependency_overrides[get_billing_access_service] = lambda: service
    with TestClient(app) as client:
        assert client.get('/api/clients').status_code == 200
        for method in ('post', 'patch', 'put', 'delete'):
            response = getattr(client, method)('/api/clients')
            assert response.status_code == 403 and response.json()['error']['code'] == 'BILLING_READ_ONLY'
        assert len(calls) == 1
        assert client.post('/api/organization').status_code == 200
        assert client.delete('/api/organization').status_code == 200
        assert client.post('/api/org-members').status_code == 200
        assert client.patch('/api/notifications/one/read').status_code == 200
        assert client.patch('/api/activity/read').status_code == 200
        assert client.patch('/api/notifications/one/resolve').status_code == 403
        service.require_write.side_effect = None
        assert client.post('/api/clients').status_code == 200


def test_actual_api_write_routes_are_guarded_except_billing_and_legal():
    def dependencies(dep):
        return [dep.call] + [call for child in dep.dependencies for call in dependencies(child)]
    checked = 0
    for route in api_router.routes:
        if not getattr(route, 'methods', set()) & {'POST', 'PUT', 'PATCH', 'DELETE'}:
            continue
        guarded = require_operational_access in dependencies(route.dependant)
        if route.path == '/api/push-devices/{installation_id}/revoke':
            # Cleanup must work after logout/session expiry. This route only
            # accepts a device capability and cannot register or read devices.
            from app.api.routes.push_devices import get_push_device_cleanup_service
            assert get_push_device_cleanup_service in dependencies(route.dependant)
            assert route.methods == {'POST'}
            assert not guarded
        elif route.path.startswith(('/api/billing/', '/api/legal/')):
            assert not guarded, route.path
        else:
            assert guarded, route.path
            checked += 1
    assert checked > 20


def test_expired_invitation_agency_is_checked_before_creating_person(monkeypatch):
    org_id = uuid4()
    user = SimpleNamespace(id=uuid4(), email='worker@example.test', user_metadata={})
    service = OrgMemberService(MagicMock(), user)
    service.invitation_repo = MagicMock()
    service.person_repo = MagicMock()
    service.invitation_repo.get_pending_for_identity.return_value = SimpleNamespace(
        org_id=org_id, invited_at=datetime.now(timezone.utc))
    guard = MagicMock(side_effect=AppError(403, 'BILLING_READ_ONLY', 'Read only'))
    monkeypatch.setattr(BillingAccessService, 'require_org_write', guard)
    with pytest.raises(AppError):
        asyncio.run(service.create_member(SimpleNamespace()))
    guard.assert_called_once_with(org_id)
    service.invitation_repo.get_pending_for_identity.assert_called_once_with(user.id, user.email, lock=True)
    service.person_repo.get_by_email.assert_not_called()
    service.db.commit.assert_not_called()
