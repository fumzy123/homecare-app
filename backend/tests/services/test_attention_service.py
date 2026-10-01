from datetime import datetime, date, timedelta
from types import SimpleNamespace as NS
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from app.core.enums import CareArrangement, ComplianceDocumentType, ShiftCompletionStatus
from app.services.attention_service import AttentionService


@pytest.fixture
def service(monkeypatch):
    class Clock(datetime):
        @classmethod
        def now(cls, tz=None):
            return cls(2026, 10, 1, 12, tzinfo=tz)
    monkeypatch.setattr('app.services.attention_service.datetime', Clock)
    service = AttentionService.__new__(AttentionService)
    service.org_id = uuid4()
    service.org_repo = MagicMock()
    service.org_repo.get_by_id.return_value = NS(billing_timezone='America/St_Johns')
    service.attention_repo = MagicMock()
    for name in ['clients', 'care_needs', 'placements', 'assignments', 'credentials', 'authorizations', 'shifts']:
        getattr(service.attention_repo, name).return_value = []
    return service


def client():
    return NS(id=uuid4(), first_name='Robert', last_name='Ellis', care_arrangement=CareArrangement.funded)


def shift(c, day, status=ShiftCompletionStatus.scheduled, moved=None):
    return NS(id=uuid4(), client_id=c.id, client=c, start_time=datetime.combine(day, datetime.min.time()).replace(hour=9),
              end_time=datetime.combine(day, datetime.min.time()).replace(hour=10), is_recurring=False,
              service_type=None, location=None, notes=None,
              modifications=[NS(id=uuid4(), original_date=day, new_start_time=moved, new_end_time=None, completion_status=status, notes=None)])


def test_specific_coverage_suppresses_weekly_gap_and_partial_remains(service):
    c = client()
    need = NS(id=uuid4(), client_id=c.id, imported=False, ends_on=None, effective_from=date(2026, 10, 1),
              scheduled_from=None, care_slots=[NS(id=uuid4())])
    service.attention_repo.clients.return_value = [c]
    service.attention_repo.care_needs.return_value = [need]
    result = service.list_items()
    assert [(i.category, i.stage) for i in result.items] == [('coverage', 'post_placement')]
    assert result.week_start == date(2026, 9, 27) and result.week_end == date(2026, 10, 3)
    assert result.org_id == service.org_id


@pytest.mark.parametrize('status,gap', [(ShiftCompletionStatus.cancelled, True), (ShiftCompletionStatus.scheduled, False), (ShiftCompletionStatus.completed, False), (ShiftCompletionStatus.no_show, False)])
def test_weekly_gap_uses_effective_schedule_status(service, status, gap):
    c = client()
    service.attention_repo.clients.return_value = [c]
    service.attention_repo.shifts.return_value = [shift(c, date(2026, 10, 1), status)]
    assert bool(service.list_items().items) is gap


def test_dropped_visit_keeps_original_occurrence_identity_and_effective_date(service):
    c = client()
    original = date(2026, 8, 1)
    s = shift(c, original, ShiftCompletionStatus.dropped, datetime(2026, 10, 1, 9))
    service.attention_repo.clients.return_value = [c]
    service.attention_repo.shifts.return_value = [s]
    items = service.list_items().items
    assert len(items) == 1  # No second warning for the same weekly gap.
    assert items[0].target.occurrence_date == original
    assert items[0].due_on == date(2026, 10, 1)
    assert items[0].id == f'visit:{s.id}:{original}'
    s.modifications[0].new_start_time = datetime(2027, 1, 1, 9)
    assert all(i.stage != 'replace_worker' for i in service.list_items().items)


def test_renewed_document_progresses_to_verification_then_disappears(service):
    worker = uuid4()
    credential = NS(id=uuid4(), document_type=ComplianceDocumentType.first_aid_cpr,
                    file_url='document.pdf', verified_at=datetime(2026, 1, 1), expiry_date=date(2026, 10, 3))
    service.attention_repo.credentials.return_value = [(credential, worker, 'Sample', 'Worker')]
    before = service.list_items().items[0]
    credential.verified_at = None
    credential.expiry_date = None
    after = service.list_items().items[0]
    assert before.stage == 'renew_credential' and after.stage == 'verify_credential'
    assert before.id == after.id
    service.attention_repo.credentials.return_value = []  # Renewed and verified by the existing document flow.
    assert not service.list_items().items


def test_authorization_excludes_cancelled_superseded_and_outside_window(service):
    c = client()
    service.attention_repo.clients.return_value = [c]
    def auth(**changes):
        return NS(**(dict(id=uuid4(), client_id=c.id, client=c, supersedes_id=None, cancelled_at=None,
                         covering_start=date(2026, 1, 1), covering_end=date(2026, 10, 10), funder='Funder', authorization_number='A') | changes))
    old, cancelled, later = auth(), auth(cancelled_at=datetime.now()), auth(covering_end=date(2026, 12, 1))
    replacement = auth(supersedes_id=old.id)
    boundary = auth(covering_end=date(2026, 10, 16))
    service.attention_repo.authorizations.return_value = [old, cancelled, later, replacement, boundary]
    items = [i for i in service.list_items().items if i.category == 'authorizations']
    assert {i.target.detail_id for i in items} == {replacement.id, boundary.id}


def test_failed_source_is_not_reported_as_all_clear(service):
    service.attention_repo.credentials.side_effect = RuntimeError('Unavailable')
    with pytest.raises(RuntimeError):
        service.list_items()
