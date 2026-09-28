from types import SimpleNamespace
from datetime import datetime, timezone
from uuid import uuid4
from unittest.mock import MagicMock
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from app.api.api import router
from app.core.config import settings
from app.core.exceptions import AppError, app_error_handler
from app.core.security import get_current_user, require_billing_operator
from app.db.session import get_db
from app.models.organization import Organization
from app.models.billing_agreement import BillingAgreement
from app.models.trial_activation import TrialActivation
from app.models.founding_offer import FoundingOffer
from app.models.founding_conversion import FoundingConversion
from app.models.billing_settlement import BillingSettlement, BillingInvoiceHold
from app.models.billing_usage_cutoff import BillingUsageCutoff
from app.services.billing_operator_service import BillingOperatorService
from app.services import billing_operator_service as module


@pytest.fixture
def operator(monkeypatch):
    user = SimpleNamespace(id=uuid4())
    monkeypatch.setattr(settings, 'billing_operator_user_ids', [str(user.id)])
    return user


def test_owner_metadata_cannot_grant_operator_access(operator):
    db = MagicMock()
    forged = SimpleNamespace(id=uuid4(), user_metadata={'role': 'owner', 'is_operator': True})
    service = BillingOperatorService(db, forged)
    for method, args in [(service.access, ()), (service.agencies, ()), (service.agency, (uuid4(),)),
                         (service.periods, (uuid4(),)), (service.recheck, (uuid4(),))]:
        with pytest.raises(AppError) as error:
            method(*args)
        assert error.value.status_code == 403
    db.query.assert_not_called()


def test_all_operator_endpoints_have_operator_guard():
    def dependencies(dep):
        return [dep.call] + [call for child in dep.dependencies for call in dependencies(child)]
    paths = [route for route in router.routes if route.path.startswith('/api/billing/operator/')]
    assert len(paths) >= 12
    for route in paths:
        assert require_billing_operator in dependencies(route.dependant), route.path


def test_http_permission_denied_and_operator_without_agency_is_allowed(operator):
    app = FastAPI()
    app.add_exception_handler(AppError, app_error_handler)
    app.include_router(router)
    db = MagicMock()
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id=uuid4(), user_metadata={'role': 'owner'})
    org = uuid4()
    with TestClient(app) as client:
        for path in ['/access', '/organizations', f'/organizations/{org}', f'/organizations/{org}/periods']:
            assert client.get('/api/billing/operator' + path).status_code == 403
        assert client.post(f'/api/billing/operator/organizations/{org}/recheck').status_code == 403
        db.query.assert_not_called()
        app.dependency_overrides[get_current_user] = lambda: operator
        response = client.get('/api/billing/operator/access')
        assert response.status_code == 200 and response.json()['is_operator'] is True
        db.query.assert_not_called()


def test_agency_search_pagination_and_details_do_not_expose_payment_secrets(operator):
    engine = create_engine('sqlite://')
    for model in (Organization, BillingAgreement, TrialActivation, FoundingOffer, FoundingConversion, BillingSettlement,
                  BillingInvoiceHold, BillingUsageCutoff):
        model.__table__.create(engine)
    with Session(engine) as db:
        ids = []
        for index in range(22):
            oid = uuid4()
            ids.append(oid)
            db.add(Organization(id=oid, owner_id=uuid4(), name=f'Agency {index}', stripe_customer_id='cus_private'))
        special = uuid4()
        db.add(Organization(id=special, owner_id=uuid4(), name='Care%Harbor'))
        db.commit()
        service = BillingOperatorService(db, operator)
        first = service.agencies('agency')
        second = service.agencies('agency', first['next_cursor'])
        assert len(first['agencies']) == 20 and len(second['agencies']) == 2
        assert set(row['id'] for row in first['agencies']).isdisjoint(row['id'] for row in second['agencies'])
        assert second['next_cursor'] is None
        assert service.agencies('%')['agencies'][0]['id'] == special
        now = datetime.now(timezone.utc)
        db.add(BillingAgreement(org_id=ids[0], plan_code='standard', plan_version=1, base_interval='month',
            stripe_price_id='price_private', consent_version='v1', accepted_at=now, accepted_by=operator.id,
            payment_method_id='pm_private'))
        db.add(BillingSettlement(id=uuid4(), org_id=ids[0], period_id=uuid4(), source_key='own', amount_cents=500,
            currency='cad', state='needs_review', context={'secret': 'do-not-return'}, steps={'secret': 'do-not-return'},
            created_at=now, updated_at=now, error_code='AMBIGUOUS_OPERATION_EXPIRED'))
        db.add(BillingSettlement(id=uuid4(), org_id=ids[1], period_id=uuid4(), source_key='foreign', amount_cents=500,
            currency='cad', state='needs_review', context={}, steps={}, created_at=now, updated_at=now))
        db.commit()
        detail = service.agency(ids[0])
        assert detail['plan']['card_saved'] is True
        assert len(detail['issues']['settlements']) == 1
        assert all(value not in str(detail) for value in ['cus_private', 'pm_private', 'price_private', 'do-not-return'])
    engine.dispose()


def test_recheck_uses_recovery_without_resetting_settlement_operations(operator, monkeypatch):
    monkeypatch.setattr(settings, 'billing_onboarding_enabled', True)
    db = MagicMock()
    service = BillingOperatorService(db, operator)
    service.org_repo = MagicMock()
    recovery = MagicMock()
    recovery.recover.return_value = 2
    factory = MagicMock(return_value=recovery)
    monkeypatch.setattr(module, 'BillingPeriodRecoveryService', factory)
    org = uuid4()
    assert service.recheck(org) == {'recovered_periods': 2}
    recovery.recover.assert_called_once_with(org)
    db.add.assert_not_called()
    recovery.recover.side_effect = RuntimeError('private Stripe response')
    with pytest.raises(AppError) as error:
        service.recheck(org)
    assert error.value.code == 'BILLING_REVIEW_REQUIRED' and 'private' not in error.value.message
    monkeypatch.setattr(settings, 'billing_onboarding_enabled', False)
    factory.reset_mock()
    with pytest.raises(AppError) as error:
        service.recheck(org)
    assert error.value.code == 'ONBOARDING_DISABLED'
    factory.assert_not_called()
