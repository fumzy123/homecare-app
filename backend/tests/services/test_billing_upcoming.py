from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from uuid import uuid4
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from app.models.organization import Organization
from app.models.billing_agreement import BillingAgreement
from app.models.founding_conversion import FoundingConversion
from app.models.billing_period import BillingPeriod
from app.models.billing_usage_snapshot import BillingUsageSnapshot
from app.models.billing_settlement import BillingSettlement
from app.models.billing_adjustment import BillingAdjustment
from app.models.billing_usage_cutoff import BillingUsageCutoff
from app.services.billing_upcoming_service import BillingUpcomingService

NOW = datetime(2026, 9, 28, tzinfo=timezone.utc)


@pytest.mark.parametrize('interval,amount', [('month', 30000), ('year', 300000)])
def test_base_shows_actual_renewal_interval_and_cancellation(interval, amount):
    org = SimpleNamespace(subscription_status='active', trial_ends_at=NOW - timedelta(days=60),
        subscription_current_period_end=NOW + timedelta(days=300 if interval == 'year' else 20))
    agreement = SimpleNamespace(canceled_at=None, base_interval=interval, plan_code='standard', plan_version=1)
    base = BillingUpcomingService._base(org, agreement, None, NOW)
    assert base['amount_cents'] == amount and base['scheduled_at'] == org.subscription_current_period_end
    assert base['interval'] == interval
    agreement.canceled_at = NOW
    assert BillingUpcomingService._base(org, agreement, None, NOW)['amount_cents'] is None
    assert BillingUpcomingService._base(org, agreement, None, NOW)['state'] == 'canceled'


def test_trial_and_founding_transition_do_not_guess_future_rates():
    org = SimpleNamespace(subscription_status='trialing', trial_ends_at=NOW + timedelta(days=14), subscription_current_period_end=None)
    agreement = SimpleNamespace(canceled_at=None, base_interval='month', plan_code='founding', plan_version=1)
    assert BillingUpcomingService._base(org, agreement, None, NOW)['state'] == 'first_payment'
    org.subscription_status = None
    assert BillingUpcomingService._base(org, agreement, None, NOW)['scheduled_at'] is None
    org.subscription_status = 'active'
    org.trial_ends_at = datetime(2025, 10, 1, tzinfo=timezone.utc)
    org.subscription_current_period_end = datetime(2026, 10, 1, tzinfo=timezone.utc)
    assert BillingUpcomingService._base(org, agreement, None, NOW)['state'] == 'needs_review'
    conversion = SimpleNamespace(effective_at=org.subscription_current_period_end, target_plan_version=1, status='pending')
    assert BillingUpcomingService._base(org, agreement, conversion, NOW)['state'] == 'needs_review'
    conversion.status = 'scheduled'
    assert BillingUpcomingService._base(org, agreement, conversion, NOW)['amount_cents'] == 30000
    org.subscription_status = 'past_due'
    assert BillingUpcomingService._base(org, agreement, conversion, NOW)['amount_cents'] is None


def test_annual_pending_balance_includes_approved_unbilled_corrections():
    from unittest.mock import MagicMock
    svc = BillingUpcomingService(MagicMock(), None, uuid4())
    for name in ('org_repo', 'agreement_repo', 'conversion_repo', 'upcoming_repo'):
        setattr(svc, name, MagicMock())
    svc.org_repo.get_by_id.return_value = SimpleNamespace(onboarding_deadline_at=NOW,
        subscription_status='active', trial_ends_at=NOW-timedelta(days=100),
        subscription_current_period_end=NOW+timedelta(days=200), billing_recovery_error=None,
        billing_recovery_checked_at=NOW, subscription_id='sub_test')
    svc.agreement_repo.get_for_org.return_value = SimpleNamespace(plan_code='standard', plan_version=2,
        base_interval='year', canceled_at=None)
    pid = uuid4()
    entry = dict(id=pid, state='accrued', usage_amount_cents=10000, cutoff_state=None)
    svc.upcoming_repo.pending_periods.return_value = [SimpleNamespace(**entry, _mapping=entry)]
    correction = dict(id=uuid4(), period_id=pid, amount_cents=-500)
    svc.upcoming_repo.pending_corrections.return_value = [SimpleNamespace(_mapping=correction)]
    result = svc.summary(NOW)
    assert result['periods'][0]['usage_amount_cents'] == 9500
    assert result['periods'][0]['adjustment_amount_cents'] == -500
    assert result['corrections'] == []  # Not a separate payment while annual usage is unbilled.
    assert result['base']['amount_cents'] == 336000
    assert result['collection_at'] == NOW+timedelta(days=203)


def test_pending_periods_and_corrections_are_scoped_and_never_recounted():
    engine = create_engine('sqlite://')
    for model in (Organization, BillingAgreement, FoundingConversion, BillingPeriod,
                  BillingUsageSnapshot, BillingSettlement, BillingAdjustment, BillingUsageCutoff):
        model.__table__.create(engine)
    with Session(engine) as db:
        org, foreign = uuid4(), uuid4()
        db.add(Organization(id=org, owner_id=uuid4(), name='Agency', onboarding_deadline_at=NOW,
                            billing_recovery_checked_at=NOW))
        ids = []
        for index, (scope, amount, state) in enumerate([
            (org, None, None), (org, 1000, None), (org, 0, None),
            (org, 500, 'invoiced'), (org, 500, 'needs_review'), (foreign, 999, None), (org, None, None),
        ]):
            pid = uuid4()
            ids.append(pid)
            start = NOW - timedelta(days=60 + index)
            end = start + timedelta(days=30)
            db.add(BillingPeriod(id=pid, org_id=scope, subscription_id='sub_test', starts_at=start, ends_at=end,
                anchor_at=start, agency_timezone='UTC', plan_code='standard', plan_version=1, base_interval='month',
                included_clients=10, additional_client_amount_cents=500, currency='cad', finalization_eligible_at=end + timedelta(hours=72)))
            if amount is not None:
                db.add(BillingUsageSnapshot(period_id=pid, org_id=scope, finalized_at=NOW, active_client_count=12,
                    additional_clients=2, usage_amount_cents=amount, payload={'private': 'not for summary'}))
            if state:
                db.add(BillingSettlement(id=uuid4(), org_id=scope, period_id=pid, source_key=f"usage:{pid}",
                    amount_cents=amount, currency='cad', state=state, payment_status='open', context={}, steps={}, created_at=NOW, updated_at=NOW))
            if index == 6:
                db.add(BillingUsageCutoff(org_id=org, subscription_id='sub_test', starts_at=start, ends_at=end,
                    deadline_at=end + timedelta(hours=72), captured_at=NOW, agency_timezone='UTC', state='needs_review'))
        for index, (scope, status, settled, amount) in enumerate([
            (org, 'approved', 'pending', -500), (org, 'rejected', 'not_approved', -500),
            (org, 'pending', 'not_approved', 500), (org, 'approved', 'settled', 500),
            (foreign, 'approved', 'pending', 999), (org, 'approved', 'not_required', 0),
        ]):
            db.add(BillingAdjustment(id=uuid4(), org_id=scope, period_id=ids[1], request_id=uuid4(),
                baseline_sequence=index, approval_sequence=index + 1 if status == 'approved' else None, status=status, amount_cents=amount,
                currency='cad', reason='Correction', proposed_by=uuid4(), proposed_at=NOW,
                settlement_status=settled, payload={}))
        db.commit()
        summary = BillingUpcomingService(db, None, org).summary(NOW)
        periods = {row['id']: row for row in summary['periods']}
        assert len(periods) == 5 and ids[3] not in periods and ids[5] not in periods
        assert periods[ids[0]]['usage_amount_cents'] is None
        assert periods[ids[0]]['state'] == 'awaiting_finalization'
        assert periods[ids[2]]['usage_amount_cents'] == 0 and periods[ids[2]]['state'] == 'ready'
        assert periods[ids[4]]['state'] == 'needs_review'
        assert periods[ids[6]]['state'] == 'needs_review'
        assert len(summary['corrections']) == 1 and summary['corrections'][0]['amount_cents'] == -500
        assert summary['tax_status'] == 'not_calculated'
        assert 'private' not in str(summary)
        assert db.query(BillingPeriod).count() == 7  # Read endpoint creates nothing.
    engine.dispose()
