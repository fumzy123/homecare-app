from datetime import datetime, timedelta, timezone
from uuid import uuid4
from unittest.mock import MagicMock
import pytest
import stripe
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.dialects.postgresql import JSONB
from app.core.config import settings
from app.models.organization import Organization
from app.models.billing_agreement import BillingAgreement
from app.models.billing_notice import BillingNotice
from app.models.admin_notification import Notification, NotificationRead
from app.services.billing_notice_service import BillingNoticeService


@compiles(JSONB, "sqlite")
def compile_jsonb_sqlite(_element, _compiler, **_kw):
    return "JSON"


NOW = datetime(2026, 9, 28, tzinfo=timezone.utc)


@pytest.fixture
def fixture(monkeypatch):
    monkeypatch.setattr(settings, "billing_notifications_enabled", True)
    engine = create_engine("sqlite://")
    for model in (Organization, BillingAgreement, Notification, NotificationRead, BillingNotice):
        model.__table__.create(engine)
    with Session(engine) as db:
        org = Organization(id=uuid4(), owner_id=uuid4(), name="Agency", stripe_customer_id="cus_one", subscription_id="sub_one",
            subscription_status="trialing", onboarding_deadline_at=NOW, trial_ends_at=NOW + timedelta(days=3))
        db.add(org)
        db.add(BillingAgreement(org_id=org.id, plan_code="standard", plan_version=1, base_interval="month",
            stripe_price_id="price_one", consent_version="v1", accepted_at=NOW, accepted_by=org.owner_id))
        db.commit()
        service = BillingNoticeService(db)
        service.notification_repo.create_reads_for_admins = MagicMock()
        subscription = stripe.StripeObject.construct_from({"id": "sub_one", "customer": "cus_one", "status": "trialing",
            "trial_end": int((NOW + timedelta(days=3)).timestamp()), "cancel_at_period_end": False}, None)
        monkeypatch.setattr(stripe.Subscription, "retrieve", lambda _: subscription)
        yield db, org, service, subscription
    engine.dispose()


def test_trial_cadence_boundaries_and_duplicate_scans(fixture):
    db, org, service, _ = fixture
    assert not service.trial_reminder(org.id, NOW - timedelta(seconds=1))
    assert service.trial_reminder(org.id, NOW)
    assert not service.trial_reminder(org.id, NOW)
    assert service.trial_reminder(org.id, NOW + timedelta(days=2))
    assert not service.trial_reminder(org.id, NOW + timedelta(days=3))
    assert db.query(Notification).count() == db.query(BillingNotice).count() == 2
    assert service.notification_repo.create_reads_for_admins.call_count == 2


def test_annual_reminders_dedupe_and_show_canceled_renewal(fixture, monkeypatch):
    from app.services import billing_notice_service as module
    db, org, service, _ = fixture
    org.subscription_status = 'active'
    org.subscription_current_period_end = NOW + timedelta(days=30)
    agreement = db.query(BillingAgreement).one()
    agreement.plan_version, agreement.base_interval, agreement.canceled_at = 2, 'year', NOW
    db.commit()
    upcoming = MagicMock()
    upcoming.return_value.summary.return_value = dict(history_needs_review=False,
        periods=[dict(state='ready', usage_amount_cents=25000)], corrections=[], base={'amount_cents': None})
    monkeypatch.setattr(module, 'BillingUpcomingService', upcoming)
    assert not service.annual_reminder(org.id, NOW - timedelta(seconds=1))
    for days in (0, 23, 29):
        assert service.annual_reminder(org.id, NOW + timedelta(days=days))
        assert not service.annual_reminder(org.id, NOW + timedelta(days=days))
    assert not service.annual_reminder(org.id, NOW + timedelta(days=30))
    notices = db.query(Notification).all()
    assert len(notices) == 3
    assert all(n.payload['finalized_usage_cents'] == 25000 and n.payload['renewal_canceled'] for n in notices)
    assert notices[0].payload['collection_at'] == (NOW + timedelta(days=33)).isoformat()


def test_annual_reminder_does_not_present_incomplete_history_as_total(fixture, monkeypatch):
    from app.services import billing_notice_service as module
    db, org, service, _ = fixture
    org.subscription_status = 'active'
    org.subscription_current_period_end = NOW + timedelta(days=1)
    agreement = db.query(BillingAgreement).one()
    agreement.plan_version, agreement.base_interval = 2, 'year'
    db.commit()
    upcoming = MagicMock()
    upcoming.return_value.summary.return_value = dict(history_needs_review=True,
        periods=[], corrections=[], base={'amount_cents': 336000})
    monkeypatch.setattr(module, 'BillingUpcomingService', upcoming)
    assert service.annual_reminder(org.id, NOW)
    assert db.query(Notification).one().payload['finalized_usage_cents'] is None


def test_missed_window_sends_only_one_day_notice_and_portal_cancellation_is_respected(fixture):
    db, org, service, subscription = fixture
    subscription.cancel_at_period_end = True
    assert service.trial_reminder(org.id, NOW + timedelta(days=2, hours=2))
    notice = db.query(Notification).one()
    assert notice.payload["renewal_canceled"] is True
    assert db.query(BillingNotice).count() == 1


def test_payment_alert_dedupes_and_old_failure_after_paid_resolves(fixture, monkeypatch):
    db, org, service, _ = fixture
    invoice = stripe.StripeObject.construct_from({"id": "in_one", "customer": "cus_one", "status": "open"}, None)
    remote = stripe.StripeObject.construct_from({"id": "in_one", "customer": "cus_one", "status": "open"}, None)
    monkeypatch.setattr(stripe.Invoice, "retrieve", lambda _: remote)
    service.payment_status(invoice)
    service.payment_status(invoice)
    notice = db.query(Notification).one()
    assert notice.requires_action and notice.resolved_at is None
    remote.status = "paid"
    service.payment_status(invoice)  # Incoming failure object is stale.
    assert db.query(Notification).one().resolved_at is not None
    service.payment_status(invoice)
    assert db.query(Notification).count() == 1


def test_disabled_flag_and_inactive_trials_do_not_notify(fixture, monkeypatch):
    db, org, service, subscription = fixture
    monkeypatch.setattr(settings, "billing_notifications_enabled", False)
    assert not service.trial_reminder(org.id, NOW)
    service.payment_status(None)
    monkeypatch.setattr(settings, "billing_notifications_enabled", True)
    subscription.status = "active"
    assert not service.trial_reminder(org.id, NOW)
    assert db.query(Notification).count() == 0


def test_notification_and_dedupe_roll_back_together(fixture, monkeypatch):
    db, org, service, subscription = fixture
    original = db.commit
    monkeypatch.setattr(db, "commit", MagicMock(side_effect=RuntimeError("database failed")))
    with pytest.raises(RuntimeError):
        service.trial_reminder(org.id, NOW)
    monkeypatch.setattr(db, "commit", original)
    assert db.query(Notification).count() == db.query(BillingNotice).count() == 0
    assert service.trial_reminder(org.id, NOW)
