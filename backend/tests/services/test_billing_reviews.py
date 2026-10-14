from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from uuid import uuid4
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.exceptions import AppError
from app.models.organization import Organization
from app.models.billing_period import BillingPeriod
from app.models.billing_review_request import BillingReviewRequest
from app.services.billing_review_service import BillingReviewService


@pytest.fixture
def review():
    engine = create_engine("sqlite://")
    for model in (Organization, BillingPeriod, BillingReviewRequest):
        model.__table__.create(engine)
    with Session(engine) as db:
        user = SimpleNamespace(id=uuid4())
        org = Organization(id=uuid4(), name="Fictional Agency", owner_id=user.id)
        start = datetime(2026, 1, 1, tzinfo=timezone.utc)
        period = BillingPeriod(id=uuid4(), org_id=org.id, subscription_id="sub_example", starts_at=start,
            ends_at=start + timedelta(days=31), anchor_at=start, agency_timezone="UTC", plan_code="standard",
            plan_version=3, base_interval="month", included_clients=10, additional_client_amount_cents=1000,
            currency="cad", finalization_eligible_at=start + timedelta(days=34))
        db.add_all([org, period])
        db.commit()
        yield BillingReviewService(db, user, org.id), period.id
    engine.dispose()


def test_submit_retry_does_not_duplicate_or_rewrite_report(review):
    service, period = review
    request = uuid4()
    first = service.submit(period, request, "Please review the client count.")
    assert service.submit(period, request, first["message"])["id"] == first["id"]
    with pytest.raises(AppError) as error:
        service.submit(period, request, "Different billing question.")
    assert error.value.status_code == 409
    assert len(service.list(period)) == 1


def test_agency_cannot_read_or_report_other_agency_period(review):
    service, period = review
    other = BillingReviewService(service.db, service.current_user, uuid4())
    with pytest.raises(AppError):
        other.list(period)
    with pytest.raises(AppError):
        other.submit(period, uuid4(), "Please review this period.")
    assert service.list(period) == []


def test_only_operator_can_resolve_and_response_is_preserved(review, monkeypatch):
    service, period = review
    row = service.submit(period, uuid4(), "Please review the client count.")
    monkeypatch.setattr(settings, "billing_operator_user_ids", [])
    with pytest.raises(AppError):
        service.resolve(row["id"], "Reviewed; the count is correct.")
    monkeypatch.setattr(settings, "billing_operator_user_ids", [str(service.current_user.id)])
    assert service.queue()["requests"][0]["agency_name"] == "Fictional Agency"
    resolved = service.resolve(row["id"], "Reviewed; the count is correct.")
    assert resolved["status"] == "resolved"
    assert service.resolve(row["id"], resolved["response"])["response"] == resolved["response"]
    with pytest.raises(AppError):
        service.resolve(row["id"], "Overwritten explanation.")
    assert service.queue()["requests"] == []
