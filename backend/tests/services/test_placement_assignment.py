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
    for name in ('repo', 'client_repo', 'shift_repo', 'cutoff_service', 'availability_repo', 'checker', 'auth_repo'):
        setattr(service, name, MagicMock())
    worker = NS(id=uuid4(), person_id=uuid4(), person=NS(first_name='Alex', last_name='Worker'))
    placement = NS(id=uuid4(), org_id=service.org_id, client_id=uuid4(), status=PlacementStatus.open,
        interests=[], start_date=date(2090, 1, 2), masked_location='Office address',
        care_plan_snapshot=[dict(day_of_week='MO', start_time='09:00:00', end_time='11:00:00', service_type='personal_care')])
    service.repo.lock_for_org.return_value = placement
    service.repo.get_by_id.return_value = placement
    service.repo.active_worker.return_value = worker
    service.client_repo.get_active_client.return_value = NS(id=placement.client_id, care_arrangement=CareArrangement.self_pay,
        street='1 Main', city='City', province='NL', postal_code='A1A1A1')
    service._eligibility_for = MagicMock(return_value=InterestEligibility(
        availability_ok=True, no_conflicts=True, within_hours=True, all_clear=True, reasons=[]))
    service._to_detail = MagicMock(return_value='detail')
    def fill(p, employment):
        p.status = PlacementStatus.filled
        p.filled_by = employment
    service.repo.fill.side_effect = fill
    notifications = MagicMock()
    monkeypatch.setattr('app.services.placement_service.NotificationService', lambda *a, **kw: notifications)
    return service, placement, worker, notifications


def test_direct_assignment_without_interest_is_atomic_and_replay_safe(setup):
    service, placement, worker, notices = setup
    order = MagicMock()
    order.attach_mock(service.cutoff_service.seal_due, 'agency')
    order.attach_mock(service.repo.lock_for_org, 'placement')
    order.attach_mock(service._eligibility_for, 'eligibility')
    assert service.assign_worker(placement.id, worker.id) == 'detail'
    assert [c[0] for c in order.mock_calls] == ['agency', 'placement', 'eligibility']
    shift = service.shift_repo.add.call_args.args[0]
    assert (shift.org_id, shift.worker_id, shift.created_by) == (service.org_id, worker.id, service.employment_id)
    assert shift.start_time.date() >= placement.start_date
    assert shift.start_time.weekday() == 0
    assert shift.recurrence_rule == 'FREQ=WEEKLY;BYDAY=MO'
    service.repo.add_interest.assert_not_called()
    notices.notify_placement_filled.assert_called_once()
    assert notices.notify_placement_filled.call_args.kwargs['commit'] is False
    service.db.commit.assert_called_once()
    with pytest.raises(AppError) as error:
        service.assign_worker(placement.id, worker.id)
    assert error.value.code == 'PLACEMENT_NOT_OPEN'
    service.shift_repo.add.assert_called_once()


def test_interest_path_keeps_requirement(setup):
    service, placement, worker, _ = setup
    with pytest.raises(AppError) as error:
        service.fill_placement(placement.id, worker.id)
    assert error.value.code == 'WORKER_NOT_INTERESTED'
    service.shift_repo.add.assert_not_called()
    placement.interests = [NS(employment_id=worker.id)]
    service.fill_placement(placement.id, worker.id)
    service.shift_repo.add.assert_called_once()


def test_preview_is_read_only_and_confirmation_rechecks(setup):
    service, placement, worker, _ = setup
    assert service.preview_assignment(placement.id, worker.id)['eligibility'].all_clear
    service.db.commit.assert_not_called()
    service.shift_repo.add.assert_not_called()
    service._eligibility_for.return_value = InterestEligibility(
        availability_ok=True, no_conflicts=False, within_hours=True, all_clear=False, reasons=['Already scheduled'])
    with pytest.raises(AppError) as error:
        service.assign_worker(placement.id, worker.id)
    assert error.value.code == 'WORKER_NOT_ELIGIBLE'
    assert service._eligibility_for.call_count == 2
    service.db.rollback.assert_called_once()
    service.shift_repo.add.assert_not_called()


@pytest.mark.parametrize('missing', ['placement', 'worker', 'client'])
def test_missing_or_inaccessible_entities_are_rejected(setup, missing):
    service, placement, worker, _ = setup
    target = {'placement': service.repo.lock_for_org, 'worker': service.repo.active_worker,
        'client': service.client_repo.get_active_client}[missing]
    target.return_value = None
    with pytest.raises(AppError) as error:
        service.assign_worker(placement.id, worker.id)
    assert error.value.status_code == 404
    service.db.commit.assert_not_called()
    service.shift_repo.add.assert_not_called()


def test_notification_failure_rolls_back_without_committing(setup):
    service, placement, worker, notices = setup
    notices.notify_placement_filled.side_effect = RuntimeError('delivery storage failed')
    with pytest.raises(RuntimeError):
        service.assign_worker(placement.id, worker.id)
    service.db.rollback.assert_called_once()
    service.db.commit.assert_not_called()


def test_no_visits_in_window_cannot_fill_placement(setup):
    service, placement, worker, _ = setup
    placement.start_date = date(2090, 1, 3)
    service._check_horizon = lambda *a: placement.start_date
    # This Thursday has no Monday care-plan occurrence.
    assert placement.start_date.weekday() != 0
    with pytest.raises(AppError) as error:
        service.assign_worker(placement.id, worker.id)
    assert error.value.code == 'NO_SCHEDULE_WINDOW'
    service.repo.fill.assert_not_called()


def test_generation_omits_groups_starting_after_authorization_end(setup):
    service, placement, worker, _ = setup
    start = date(2026, 9, 28)  # Monday
    service._funded_covering_end = lambda *a: start
    entries = [NS(day_of_week=day, start_time=time(9), end_time=time(11), service_type=kind)
        for day, kind in [(WeekDay.MO, ServiceType.personal_care), (WeekDay.TU, ServiceType.nursing)]]
    shifts = service._generate_shifts(placement, worker.id, entries, service.client_repo.get_active_client.return_value, start, start)
    assert len(shifts) == 1
    assert shifts[0].recurrence_rule == 'FREQ=WEEKLY;BYDAY=MO'


def test_new_routes_have_admin_and_operational_guards():
    from app.api.api import router
    from app.core.security import require_admin
    from app.api.billing_access import require_operational_access

    def dependencies(node):
        return {node.call} | set().union(*(dependencies(d) for d in node.dependencies))

    routes = [r for r in router.routes if r.path.endswith(('/assign', '/workers/{employment_id}/eligibility'))]
    assert len(routes) == 2
    for route in routes:
        assert require_admin in dependencies(route.dependant)
        assert require_operational_access in dependencies(route.dependant)


def test_overlapping_snapshot_cannot_double_book_selected_worker(setup):
    service, placement, worker, _ = setup
    placement.care_plan_snapshot.append(dict(placement.care_plan_snapshot[0], service_type='nursing'))
    with pytest.raises(AppError) as error:
        service.assign_worker(placement.id, worker.id)
    assert error.value.code == 'INVALID_CARE_PLAN'
    service.shift_repo.add.assert_not_called()


@pytest.mark.parametrize('gate', ['availability', 'conflict', 'overtime', 'cap'])
def test_real_eligibility_gates_block_assignment(setup, gate):
    service, placement, worker, _ = setup
    del service._eligibility_for  # Exercise the actual shared domain checks.
    service.availability_repo.list_for_person.return_value = [] if gate == 'availability' else service._parse_snapshot(placement.care_plan_snapshot)
    service.checker.find_conflicts.return_value = [dict(client_name='Other client', date='2090-01-02')] if gate == 'conflict' else []
    service.checker.find_hours_violations.return_value = (
        [dict(total_hours=42, week_start='2090-01-02')] if gate == 'overtime' else [],
        [dict(total_hours=22, max_hours=20, week_start='2090-01-02')] if gate == 'cap' else [])
    with pytest.raises(AppError) as error:
        service.assign_worker(placement.id, worker.id)
    assert error.value.code == 'WORKER_NOT_ELIGIBLE'
    service.shift_repo.add.assert_not_called()
