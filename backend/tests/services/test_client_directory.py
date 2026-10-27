from datetime import date, datetime, time
from types import SimpleNamespace as Row
from unittest.mock import MagicMock, patch
from uuid import uuid4

from app.domain.client_care import directory_care_by_client
from app.services.client_service import ClientService

TODAY = date(2026, 10, 26)


def need(version=1, **changes):
    values = dict(id=uuid4(), client_id='client', version=version, imported=False,
                  activated_at=None, effective_from=TODAY, scheduled_from=None,
                  ends_on=None, care_slots=[Row(id='monday', day_of_week='MO', start_time=time(9), end_time=time(11)),
                                           Row(id='friday', day_of_week='FR', start_time=time(9, 30), end_time=time(11))])
    return Row(**(values | changes))


def assignment(slot='monday', **changes):
    return Row(**(dict(care_slot_id=slot, starts_on=TODAY, ends_before=None) | changes))


def summary(needs, assignments=(), on_date=TODAY):
    return directory_care_by_client(needs, assignments, on_date).get('client')


def test_unposted_proposal_has_hours_slots_requested_date_and_zero_coverage():
    result = summary([need(effective_from=date(2026, 11, 2))])
    assert result == dict(weekly_hours=3.5, slot_count=2, covered_slot_count=0,
                          state='requested', starts_on=date(2026, 11, 2),
                          revision_pending=False, scheduled_change_on=None)


def test_future_approved_plan_is_not_hidden_by_new_draft():
    approved = need(activated_at=TODAY, scheduled_from=date(2026, 10, 27))
    draft = need(2, effective_from=date(2026, 11, 9), care_slots=[])
    result = summary([draft, approved], [assignment(), assignment('friday')])
    assert result['weekly_hours'] == 3.5
    assert result['covered_slot_count'] == 2
    assert result['state'] == 'scheduled'
    assert result['starts_on'] == date(2026, 10, 27)
    assert result['revision_pending']


def test_current_plan_remains_primary_with_future_change_and_proposal():
    current = need(activated_at=TODAY, scheduled_from=TODAY, ends_on=date(2026, 11, 1))
    future = need(2, activated_at=TODAY, scheduled_from=date(2026, 11, 2), care_slots=[])
    draft = need(3, effective_from=date(2026, 11, 9))
    result = summary([draft, future, current], [assignment()])
    assert result['state'] == 'current'
    assert result['starts_on'] is None
    assert result['weekly_hours'] == 3.5
    assert result['covered_slot_count'] == 1
    assert result['scheduled_change_on'] == date(2026, 11, 2)
    assert result['revision_pending']
    assert summary([current, future, draft], on_date=date(2026, 11, 2))['weekly_hours'] == 0


def test_replaced_before_start_and_ended_plans_are_not_revived():
    ended = need(activated_at=TODAY, scheduled_from=date(2026, 10, 1), ends_on=date(2026, 10, 20))
    replaced = need(2, activated_at=TODAY, scheduled_from=date(2026, 11, 2), ends_on=TODAY)
    assert summary([ended, replaced]) is None
    assert summary([]) is None


def test_coverage_uses_next_required_day_and_exclusive_assignment_end():
    approved = need(activated_at=TODAY, scheduled_from=TODAY)
    # Tuesday's summary: Friday's replacement starts in time, Monday's does not.
    rows = [assignment(ends_before=date(2026, 11, 2)),
            assignment(starts_on=date(2026, 11, 3)),
            assignment('friday', ends_before=date(2026, 10, 30)),
            assignment('friday', starts_on=date(2026, 10, 30))]
    assert summary([approved], rows, date(2026, 10, 27))['covered_slot_count'] == 1


def test_duplicate_assignment_history_does_not_double_count_slots():
    approved = need(activated_at=TODAY, scheduled_from=TODAY)
    assert summary([approved], [assignment(), assignment()])['covered_slot_count'] == 1


def test_revision_transition_does_not_invent_uncovered_weekdays():
    current = need(activated_at=TODAY, scheduled_from=TODAY, ends_on=date(2026, 10, 28))
    future = need(2, activated_at=TODAY, scheduled_from=date(2026, 10, 29), care_slots=[])
    rows = [assignment(), assignment('friday', ends_before=date(2026, 10, 29))]
    result = summary([current, future], rows)
    assert result['covered_slot_count'] == 2
    assert result['scheduled_change_on'] == date(2026, 10, 29)


def test_imported_plan_does_not_invent_slot_coverage():
    assert summary([need(imported=True)])['covered_slot_count'] is None


def test_clients_do_not_share_summaries_or_assignment_counts():
    first = need(activated_at=TODAY)
    other = need(client_id='other', care_slots=[Row(id='other-slot', day_of_week='MO', start_time=time(9), end_time=time(10))], activated_at=TODAY)
    results = directory_care_by_client([first, other], [assignment('other-slot')], TODAY)
    assert results['client']['covered_slot_count'] == 0
    assert results['other']['covered_slot_count'] == 1


def test_service_uses_agency_local_date_and_one_org_scoped_batch():
    svc = ClientService.__new__(ClientService)
    svc.db, svc.care_need_repo, svc.org_id = MagicMock(), MagicMock(), uuid4()
    svc.care_need_repo.list_for_org.return_value = [need(activated_at=TODAY, scheduled_from=date(2026, 10, 27))]
    svc.care_need_repo.assignments_for_org.return_value = []
    clients = [Row(id='client'), Row(id='no-care')]
    with patch('app.services.client_service.Workforce') as workforce:
        # Still October 26 in the agency even when the host's UTC date is October 27.
        workforce.return_value.now = datetime(2026, 10, 26, 23, 30)
        workforce.return_value.care_teams.return_value = {}
        svc._attach_many(clients)
    assert clients[0].current_care_need is None
    assert clients[0].directory_care['state'] == 'scheduled'
    assert clients[1].directory_care is None
    svc.care_need_repo.list_for_org.assert_called_once_with(svc.org_id)
    svc.care_need_repo.assignments_for_org.assert_called_once_with(svc.org_id)


def test_repository_limits_assignment_reads_to_the_requested_agency():
    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session
    from app.models import Base, WeeklyCareNeed, CareSlot, CareSlotAssignment
    from app.repositories.weekly_care_need_repository import WeeklyCareNeedRepository

    engine = create_engine('sqlite://')
    Base.metadata.create_all(engine, tables=[WeeklyCareNeed.__table__, CareSlot.__table__, CareSlotAssignment.__table__])
    first_org, other_org = uuid4(), uuid4()
    try:
        with Session(engine) as db:
            expected = None
            for org_id in [first_org, other_org]:
                client_id = uuid4()
                care = WeeklyCareNeed(org_id=org_id, client_id=client_id, version=1, effective_from=TODAY)
                db.add(care)
                db.flush()
                slot = CareSlot(weekly_care_need_id=care.id, client_id=client_id, day_of_week='MO', start_time=time(9), end_time=time(11))
                db.add(slot)
                db.flush()
                row = CareSlotAssignment(care_slot_id=slot.id, placement_id=uuid4(), employment_id=uuid4(), approved_by=uuid4(), starts_on=TODAY)
                db.add(row)
                db.flush()
                if org_id == first_org:
                    expected = row.id
            assert [a.id for a in WeeklyCareNeedRepository(db).assignments_for_org(first_org)] == [expected]
    finally:
        engine.dispose()
