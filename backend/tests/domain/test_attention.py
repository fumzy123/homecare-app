from datetime import date, timedelta
from types import SimpleNamespace as NS
from uuid import uuid4

from app.core.enums import PlacementStatus
from app.domain.attention import coverage_item


def test_coverage_case_keeps_identity_through_partial_approval_until_complete():
    today = date(2026, 10, 1)
    client = NS(id=uuid4(), first_name='Robert', last_name='Ellis')
    slots = [NS(id=uuid4()), NS(id=uuid4())]
    need = NS(id=uuid4(), client_id=client.id, imported=False, ends_on=None,
              effective_from=today + timedelta(days=20), scheduled_from=None, care_slots=slots)
    placement = NS(id=uuid4(), status=PlacementStatus.open, interests=[])
    draft = coverage_item(need, client, None, set(), today)
    assert draft.stage == 'post_placement'
    assert draft.target.record_id == client.id
    posted = coverage_item(need, client, placement, set(), today)
    assert posted.stage == 'await_interest' and posted.urgency == 'waiting'
    placement.interests = [NS(care_slot_ids=[str(slots[0].id)])]
    interested = coverage_item(need, client, placement, set(), today)
    assert interested.stage == 'review_interest'
    partial = coverage_item(need, client, placement, {slots[0].id}, today)
    assert partial.stage == 'cover_slots'
    assert partial.detail == '1 Care Slots still uncovered'
    assert {draft.id, posted.id, interested.id, partial.id} == {f'care:{need.id}'}
    assert interested.target.record_id == placement.id
    assert coverage_item(need, client, placement, {s.id for s in slots}, today) is None


def test_urgency_changes_without_creating_a_duplicate_case_and_closed_can_reopen():
    today = date(2026, 10, 1)
    client = NS(id=uuid4(), first_name='Robert', last_name='Ellis')
    need = NS(id=uuid4(), client_id=client.id, imported=False, ends_on=None,
              effective_from=today, scheduled_from=None, care_slots=[NS(id=uuid4())])
    placement = NS(id=uuid4(), status=PlacementStatus.open, interests=[])
    before = coverage_item(need, client, placement, set(), today - timedelta(days=1))
    due = coverage_item(need, client, placement, set(), today)
    assert before.id == due.id and due.urgency == 'urgent'
    placement.status = PlacementStatus.closed
    assert coverage_item(need, client, placement, set(), today).target.kind == 'care_need'
    need.ends_on = today - timedelta(days=1)
    assert coverage_item(need, client, placement, set(), today) is None
