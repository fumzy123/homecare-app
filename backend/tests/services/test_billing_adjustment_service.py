from copy import deepcopy
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from uuid import uuid4
from unittest.mock import MagicMock

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.core.enums import ShiftStatus
from app.core.exceptions import AppError
from app.models.organization import Organization
from app.models.billing_period import BillingPeriod
from app.models.billing_usage_snapshot import BillingUsageSnapshot
from app.models.billing_adjustment import BillingAdjustment, BillingAdjustmentEvent
from app.models.billing_visit_evidence import BillingVisitEvidence
from app.models.shift import Shift
from app.models.shift_modification import ShiftModification
from app.services.billing_adjustment_service import BillingAdjustmentService
from app.services import billing_adjustment_service as module

START = datetime(2026, 8, 1, tzinfo=timezone.utc)
END = datetime(2026, 9, 1, tzinfo=timezone.utc)


@pytest.fixture
def db():
    engine = create_engine("sqlite://")
    for model in (Organization, BillingPeriod, BillingUsageSnapshot, BillingAdjustment,
                  BillingAdjustmentEvent, BillingVisitEvidence, Shift, ShiftModification):
        model.__table__.create(engine)
    with Session(engine, autoflush=False) as session:
        yield session
    engine.dispose()


@pytest.fixture
def operator(monkeypatch):
    user = SimpleNamespace(id=str(uuid4()))
    monkeypatch.setattr(module, "settings", SimpleNamespace(billing_operator_user_ids=[user.id]))
    return user


def setup_period(db, original=12, corrected=11, rate=500, interval="month", cancelled=False):
    org, pid = uuid4(), uuid4()
    clients = [uuid4() for _ in range(max(original, corrected))]
    db.add(Organization(id=org, owner_id=uuid4(), name="Agency", subscription_status="canceled" if cancelled else "active",
                        deleted_at=END if cancelled else None, is_active=not cancelled))
    terms = dict(id=str(pid), starts_at=START.isoformat(), ends_at=END.isoformat(), agency_timezone="UTC",
                 included_clients=10, additional_client_amount_cents=rate, currency="cad", base_interval=interval)
    payload = dict(period=terms, clients=[{"client_id": str(client)} for client in clients[:original]],
                   active_client_count=original, usage_amount_cents=max(0, original - 10) * rate)
    db.add(BillingPeriod(id=pid, org_id=org, subscription_id="sub_test", starts_at=START, ends_at=END,
        anchor_at=START, agency_timezone="UTC", plan_code="founding" if rate == 400 else "standard", plan_version=1,
        base_interval=interval, included_clients=10, additional_client_amount_cents=rate,
        currency="cad", finalization_eligible_at=END + timedelta(hours=72)))
    db.add(BillingUsageSnapshot(period_id=pid, org_id=org, finalized_at=END + timedelta(hours=72),
        active_client_count=original, additional_clients=max(0, original - 10), usage_amount_cents=max(0, original - 10) * rate,
        payload=payload))
    for client in clients[:corrected]:
        add_visit(db, org, client)
    db.commit()
    return org, pid, clients


def add_visit(db, org, client=None):
    db.add(Shift(id=uuid4(), org_id=org, client_id=client or uuid4(), worker_id=uuid4(), created_by=uuid4(),
        start_time=datetime(2026, 8, 12, 9), end_time=datetime(2026, 8, 12, 11), status=ShiftStatus.active,
        is_recurring=False))


def propose(service, org, pid, request_id=None):
    return service.propose(org, pid, request_id or uuid4(), "Corrected the qualifying client list")


def approve(service, org, pid, aid):
    return service.decide(org, pid, aid, "approved", "Verified the correction against visit records")


@pytest.mark.parametrize("original,corrected,rate,interval,amount", [
    (12, 11, 500, "month", -500), (11, 13, 500, "month", 1000), (12, 8, 400, "month", -800),
    (8, 6, 500, "month", 0), (12, 11, 500, "year", -500),
])
def test_adjustments_use_saved_allowance_and_rates_and_preserve_snapshot(db, operator, original, corrected, rate, interval, amount):
    org, pid, _ = setup_period(db, original, corrected, rate, interval)
    original_snapshot = deepcopy(db.get(BillingUsageSnapshot, pid).payload)
    service = BillingAdjustmentService(db, operator)
    proposal = propose(service, org, pid)
    assert proposal["status"] == "pending" and proposal["amount_cents"] == amount
    assert proposal["settlement_status"] == "not_approved"
    result = approve(service, org, pid, proposal["id"])
    assert result["approval_sequence"] == 1
    assert result["settlement_status"] == ("pending" if amount else "not_required")
    assert db.get(BillingUsageSnapshot, pid).payload == original_snapshot
    events = db.query(BillingAdjustmentEvent).order_by(BillingAdjustmentEvent.occurred_at).all()
    assert [event.action for event in events] == ["proposed", "approved"]
    assert all(str(event.actor_id) == operator.id for event in events)


def test_successive_adjustments_apply_only_incremental_difference(db, operator):
    org, pid, clients = setup_period(db, 12, 11)
    service = BillingAdjustmentService(db, operator)
    first = approve(service, org, pid, propose(service, org, pid)["id"])
    add_visit(db, org, clients[-1])  # Restore the removed client: refund must be reversed exactly once.
    db.commit()
    second = approve(service, org, pid, propose(service, org, pid)["id"])
    assert first["amount_cents"] == -500 and second["amount_cents"] == 500
    assert second["baseline_sequence"] == 1 and second["approval_sequence"] == 2
    assert sum(row.amount_cents for row in db.query(BillingAdjustment)) == 0


def test_duplicate_requests_and_decisions_are_idempotent(db, operator):
    org, pid, _ = setup_period(db)
    service = BillingAdjustmentService(db, operator)
    rid = uuid4()
    first = propose(service, org, pid, rid)
    assert propose(service, org, pid, rid)["id"] == first["id"]
    result = approve(service, org, pid, first["id"])
    assert approve(service, org, pid, first["id"])["approval_sequence"] == result["approval_sequence"]
    assert db.query(BillingAdjustment).count() == 1
    assert db.query(BillingAdjustmentEvent).count() == 2
    with pytest.raises(AppError) as error:
        service.propose(org, pid, rid, "A different explanation")
    assert error.value.code == "IDEMPOTENCY_CONFLICT"


def test_pending_proposal_cannot_be_approved_against_outdated_baseline(db, operator):
    org, pid, _ = setup_period(db)
    service = BillingAdjustmentService(db, operator)
    first, second = propose(service, org, pid), propose(service, org, pid)
    approve(service, org, pid, first["id"])
    with pytest.raises(AppError) as error:
        approve(service, org, pid, second["id"])
    assert error.value.code == "STALE_ADJUSTMENT"
    assert db.get(BillingAdjustment, second["id"]).status == "pending"


def test_changed_client_list_requires_a_new_proposal_even_if_count_unchanged(db, operator):
    org, pid, _ = setup_period(db)
    service = BillingAdjustmentService(db, operator)
    proposal = propose(service, org, pid)
    row = db.query(Shift).first()
    row.client_id = uuid4()
    db.commit()
    with pytest.raises(AppError) as error:
        approve(service, org, pid, proposal["id"])
    assert error.value.code == "USAGE_CHANGED"


def test_rejection_does_not_change_baseline_or_create_settlement(db, operator):
    org, pid, _ = setup_period(db)
    service = BillingAdjustmentService(db, operator)
    proposal = propose(service, org, pid)
    rejected = service.decide(org, pid, proposal["id"], "rejected", "Evidence needs further investigation")
    assert rejected["approval_sequence"] is None and rejected["settlement_status"] == "not_approved"
    assert propose(service, org, pid)["amount_cents"] == -500
    with pytest.raises(AppError) as error:
        approve(service, org, pid, proposal["id"])
    assert error.value.code == "ALREADY_DECIDED"


def test_cancelled_archived_agency_can_receive_a_pending_credit(db, operator):
    org, pid, _ = setup_period(db, cancelled=True)
    service = BillingAdjustmentService(db, operator)
    result = approve(service, org, pid, propose(service, org, pid)["id"])
    assert result["amount_cents"] == -500 and result["settlement_status"] == "pending"


def test_operator_and_tenant_boundaries(db, operator):
    org, pid, _ = setup_period(db)
    with pytest.raises(AppError) as error:
        propose(BillingAdjustmentService(db, SimpleNamespace(id=str(uuid4()))), org, pid)
    assert error.value.status_code == 403
    service = BillingAdjustmentService(db, operator)
    proposal = propose(service, org, pid)
    with pytest.raises(AppError) as error:
        approve(service, uuid4(), pid, proposal["id"])
    assert error.value.status_code == 404
    with pytest.raises(AppError) as error:
        BillingAdjustmentService(db, operator, uuid4()).list(pid)
    assert error.value.status_code == 404
    history = BillingAdjustmentService(db, operator, org).list(pid)
    assert len(history["adjustments"]) == len(history["events"]) == 1


def test_no_change_and_blank_reason_are_rejected(db, operator):
    org, pid, _ = setup_period(db, original=11, corrected=11)
    service = BillingAdjustmentService(db, operator)
    with pytest.raises(AppError) as error:
        propose(service, org, pid)
    assert error.value.code == "NO_USAGE_CHANGE"
    with pytest.raises(AppError) as error:
        service.propose(org, pid, uuid4(), "     ")
    assert error.value.code == "INVALID_REASON"


def test_failed_approval_rolls_back_decision_and_audit_event(db, operator, monkeypatch):
    org, pid, _ = setup_period(db)
    service = BillingAdjustmentService(db, operator)
    proposal = propose(service, org, pid)
    monkeypatch.setattr(db, "commit", MagicMock(side_effect=RuntimeError("commit failed")))
    with pytest.raises(RuntimeError):
        approve(service, org, pid, proposal["id"])
    assert db.get(BillingAdjustment, proposal["id"]).status == "pending"
    assert db.query(BillingAdjustmentEvent).count() == 1


def test_unfinalized_period_cannot_receive_adjustment(db, operator):
    org, pid, _ = setup_period(db)
    db.delete(db.get(BillingUsageSnapshot, pid))
    db.commit()
    with pytest.raises(AppError) as error:
        propose(BillingAdjustmentService(db, operator), org, pid)
    assert error.value.code == "PERIOD_NOT_FINALIZED"


def test_operator_api_rejects_unlisted_user_without_touching_database(monkeypatch):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from app.api.routes.billing import router
    from app.core import security
    from app.core.exceptions import app_error_handler
    from app.db.session import get_db

    app = FastAPI()
    app.include_router(router)
    app.add_exception_handler(AppError, app_error_handler)
    fake_db = MagicMock()
    app.dependency_overrides[get_db] = lambda: fake_db
    # Claiming owner in metadata cannot grant platform billing-operator access.
    app.dependency_overrides[security.get_current_user] = lambda: SimpleNamespace(
        id=str(uuid4()), user_metadata={"role": "owner"})
    monkeypatch.setattr(security, "settings", SimpleNamespace(billing_operator_user_ids=[]))
    response = TestClient(app).post(f"/billing/operator/organizations/{uuid4()}/periods/{uuid4()}/adjustments",
        json={"request_id": str(uuid4()), "reason": "Request a billing correction"})
    assert response.status_code == 403
    fake_db.query.assert_not_called()
