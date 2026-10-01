from datetime import date, time
from types import SimpleNamespace as NS
from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from app.core.enums import PlacementStatus, WeekDay, ServiceType, CareArrangement
from app.core.exceptions import AppError
from app.schemas.placement import InterestEligibility
from app.services.placement_service import PlacementService


@pytest.fixture
def setup(monkeypatch):
    service = PlacementService.__new__(PlacementService)
    service.db = MagicMock()
    service.org_id, service.employment_id = uuid4(), uuid4()
    for name in (
        "placement_repo",
        "client_repo",
        "shift_repo",
        "cutoff_service",
        "availability_repo",
        "checker",
        "auth_repo",
    ):
        setattr(service, name, MagicMock())
    worker = NS(
        id=uuid4(), person_id=uuid4(), person=NS(first_name="Alex", last_name="Worker")
    )
    placement = NS(
        id=uuid4(),
        org_id=service.org_id,
        client_id=uuid4(),
        status=PlacementStatus.open,
        interests=[],
        start_date=date(2090, 1, 2),
        masked_location="Office address",
        care_slot_snapshot=[
            dict(
                day_of_week="MO",
                start_time="09:00:00",
                end_time="11:00:00",
                service_type="personal_care",
            )
        ],
    )
    service.placement_repo.lock_for_org.return_value = placement
    service.placement_repo.get_by_id.return_value = placement
    service.placement_repo.active_worker.return_value = worker
    service.client_repo.get_active_client.return_value = NS(
        id=placement.client_id,
        care_arrangement=CareArrangement.self_pay,
        street="1 Main",
        city="City",
        province="NL",
        postal_code="A1A1A1",
    )
    service._eligibility_for = MagicMock(
        return_value=InterestEligibility(
            availability_ok=True,
            no_conflicts=True,
            within_hours=True,
            all_clear=True,
            reasons=[],
        )
    )
    service._to_detail = MagicMock(return_value="detail")

    def fill(p, employment):
        p.status = PlacementStatus.filled
        p.filled_by = employment

    service.placement_repo.fill.side_effect = fill
    notifications = MagicMock()
    monkeypatch.setattr(
        "app.services.placement_service.NotificationService",
        lambda *a, **kw: notifications,
    )
    return service, placement, worker, notifications


@pytest.mark.parametrize("method", ["assign_worker", "fill_placement"])
def test_legacy_assignment_cannot_bypass_care_slot_review(setup, method):
    service, placement, worker, _ = setup
    with pytest.raises(AppError) as error:
        getattr(service, method)(placement.id, worker.id)
    assert error.value.code == "CARE_SLOT_REVIEW_REQUIRED"
    service.db.commit.assert_not_called()
    service.shift_repo.add.assert_not_called()


def test_generation_omits_groups_starting_after_authorization_end(setup):
    service, placement, worker, _ = setup
    start = date(2026, 9, 28)  # Monday
    service._funded_covering_end = lambda *a: start
    entries = [
        NS(day_of_week=day, start_time=time(9), end_time=time(11), service_type=kind)
        for day, kind in [
            (WeekDay.MO, ServiceType.personal_care),
            (WeekDay.TU, ServiceType.nursing),
        ]
    ]
    shifts = service._generate_shifts(
        placement,
        worker.id,
        entries,
        service.client_repo.get_active_client.return_value,
        start,
        start,
    )
    assert len(shifts) == 1
    assert shifts[0].recurrence_rule == "FREQ=WEEKLY;BYDAY=MO"


def test_new_routes_have_admin_and_operational_guards():
    from app.api.api import router
    from app.core.security import require_admin
    from app.api.billing_access import require_operational_access

    def dependencies(node):
        return {node.call} | set().union(*(dependencies(d) for d in node.dependencies))

    routes = [
        r for r in router.routes if r.path.endswith(("/approval-review", "/approve"))
    ]
    assert len(routes) == 2
    for route in routes:
        assert require_admin in dependencies(route.dependant)
        assert require_operational_access in dependencies(route.dependant)


@pytest.mark.parametrize("gate", ["availability", "conflict", "overtime", "cap"])
def test_real_eligibility_gates_block_assignment(setup, gate):
    service, placement, worker, _ = setup
    del service._eligibility_for  # Exercise the actual shared domain checks.
    service.availability_repo.list_for_person.return_value = (
        []
        if gate == "availability"
        else service._parse_snapshot(placement.care_slot_snapshot)
    )
    service.checker.find_conflicts.return_value = (
        [dict(client_name="Other client", date="2090-01-02")]
        if gate == "conflict"
        else []
    )
    service.checker.find_hours_violations.return_value = (
        [dict(total_hours=42, week_start="2090-01-02")] if gate == "overtime" else [],
        [dict(total_hours=22, max_hours=20, week_start="2090-01-02")]
        if gate == "cap"
        else [],
    )
    eligibility = service._eligibility_for(
        worker,
        service._parse_snapshot(placement.care_slot_snapshot),
        service.client_repo.get_active_client.return_value,
        placement.start_date,
        placement.start_date,
    )
    assert not eligibility.all_clear
    assert eligibility.reasons
    service.shift_repo.add.assert_not_called()


def test_funded_slots_end_with_their_own_service_authorization(setup):
    from datetime import timedelta

    service, placement, worker, _ = setup
    client = service.client_repo.get_active_client.return_value
    client.care_arrangement = CareArrangement.funded
    start = date(2090, 1, 2)
    nursing_end, personal_end = start + timedelta(days=7), start + timedelta(days=30)
    service.auth_repo.list_active_for_client.return_value = [
        NS(covering_end=nursing_end, services=[NS(service_type=ServiceType.nursing)]),
        NS(
            covering_end=personal_end,
            services=[NS(service_type=ServiceType.personal_care)],
        ),
    ]
    slots = [
        NS(
            day_of_week=WeekDay.MO,
            start_time=time(9),
            end_time=time(11),
            service_type=kind,
        )
        for kind in [ServiceType.nursing, ServiceType.personal_care]
    ]
    generated = service._generate_shifts(
        placement, worker.id, slots, client, start, start
    )
    assert {shift.service_type: shift.recurrence_end_date for shift in generated} == {
        ServiceType.nursing: nursing_end,
        ServiceType.personal_care: personal_end,
    }
