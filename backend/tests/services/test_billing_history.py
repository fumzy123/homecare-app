import asyncio
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
import stripe
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.core.exceptions import AppError
from app.models.organization import Organization
from app.models.billing_period import BillingPeriod
from app.models.billing_usage_snapshot import BillingUsageSnapshot
from app.services.billing_usage_service import BillingUsageService
from app.services.billing_service import BillingService
from app.services import billing_service as module


def test_period_history_is_scoped_paginated_and_excludes_patient_data():
    engine = create_engine('sqlite://')
    for model in (Organization, BillingPeriod, BillingUsageSnapshot):
        model.__table__.create(engine)
    with Session(engine) as db:
        org, foreign = uuid4(), uuid4()
        at = datetime(2026, 1, 1, tzinfo=timezone.utc)
        ids = []
        for index in range(23):
            pid = uuid4()
            scope = org if index < 22 else foreign
            ids.append(pid)
            db.add(BillingPeriod(id=pid, org_id=scope, subscription_id='sub_test', starts_at=at + timedelta(days=31 * index),
                ends_at=at + timedelta(days=31 * index + 30), anchor_at=at, agency_timezone='UTC',
                plan_code='standard', plan_version=1, base_interval='month', included_clients=10,
                additional_client_amount_cents=500, currency='cad', finalization_eligible_at=at))
            db.add(BillingUsageSnapshot(period_id=pid, org_id=scope, finalized_at=at,
                active_client_count=12, additional_clients=2, usage_amount_cents=1000,
                payload={'clients': [{'client_name': 'Private'}]}))
        db.commit()
        service = BillingUsageService(db, None, org)
        first = service.history()
        second = service.history(first['next_cursor'])
        assert len(first['periods']) == 20 and len(second['periods']) == 2
        assert second['next_cursor'] is None
        seen = [row['period_id'] for row in first['periods'] + second['periods']]
        assert len(set(seen)) == 22 and ids[-1] not in seen
        assert all('payload' not in row and 'clients' not in row for row in first['periods'])
        with pytest.raises(AppError) as error:
            service.history(ids[-1])
        assert error.value.status_code == 404
        assert BillingUsageService(db, None, uuid4()).history()['periods'] == []
    engine.dispose()


def invoice_service(monkeypatch, customer='cus_ours'):
    service = BillingService(MagicMock(), org_id=uuid4())
    service.org_repo = MagicMock()
    service.org_repo.get_by_id.return_value = SimpleNamespace(stripe_customer_id=customer)
    fake = MagicMock()
    # Preserve exception classes for real exception matching.
    fake.InvalidRequestError = stripe.InvalidRequestError
    monkeypatch.setattr(module, 'stripe', fake)
    return service, fake


def test_invoice_history_shows_unpaid_total_and_owned_pagination(monkeypatch):
    service, fake = invoice_service(monkeypatch)
    fake.Invoice.retrieve.return_value = {'customer': 'cus_ours'}
    fake.Invoice.list.return_value = stripe.StripeObject.construct_from(dict(has_more=True, data=[dict(
        id='in_unpaid', number='CH-123', created=123, total=40000, amount_paid=0,
        amount_remaining=40000, currency='cad', status='open', hosted_invoice_url=None,
    )]), None)
    result = asyncio.run(service.invoice_history('in_cursor'))
    row = result['invoices'][0]
    assert row['total'] == row['amount_remaining'] == 40000 and row['amount_paid'] == 0
    assert row['hosted_invoice_url'] is None and result['next_cursor'] == 'in_unpaid'
    fake.Invoice.list.assert_called_once_with(customer='cus_ours', limit=20, starting_after='in_cursor')


def test_foreign_invoice_cursor_cannot_read_another_agency(monkeypatch):
    service, fake = invoice_service(monkeypatch)
    fake.Invoice.retrieve.return_value = {'customer': 'cus_foreign'}
    with pytest.raises(AppError) as error:
        asyncio.run(service.invoice_history('in_foreign'))
    assert error.value.status_code == 404
    fake.Invoice.list.assert_not_called()


def test_no_customer_has_empty_history_and_stripe_failure_is_not_empty(monkeypatch):
    service, fake = invoice_service(monkeypatch, None)
    assert asyncio.run(service.invoice_history()) == {'invoices': [], 'next_cursor': None}
    fake.Invoice.list.assert_not_called()
    service.org_repo.get_by_id.return_value.stripe_customer_id = 'cus_ours'
    fake.Invoice.list.side_effect = RuntimeError('private remote details')
    with pytest.raises(AppError) as error:
        asyncio.run(service.invoice_history())
    assert error.value.status_code == 503 and 'private' not in error.value.message
