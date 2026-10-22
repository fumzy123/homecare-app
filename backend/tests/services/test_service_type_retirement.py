import asyncio
from datetime import date, datetime, time
from types import SimpleNamespace as NS
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.core.enums import ShiftCompletionStatus, WeekDay
from app.schemas.weekly_care_need import WeeklyCareNeedCreate, CareSlotResponse
from app.schemas.shift import ShiftCreateSchema, CareMetricsResponse
from app.services.placement_service import PlacementService
from app.services.shift_service import ShiftService
from tests.services.test_weekly_care_need_save import setup_save


def test_care_slots_need_only_day_and_times_and_still_reject_overlap():
    slot = dict(day_of_week='MO', start_time='09:00', end_time='11:00')
    need = WeeklyCareNeedCreate(effective_from=date.today(), care_slots=[slot])
    assert need.care_slots[0].model_dump(mode='json') == {
        'day_of_week': 'MO', 'start_time': '09:00:00', 'end_time': '11:00:00',
    }
    with pytest.raises(ValidationError, match='cannot overlap'):
        WeeklyCareNeedCreate(effective_from=date.today(), care_slots=[slot, slot])


def test_legacy_classification_does_not_create_a_new_revision():
    service, payload, latest = setup_save()
    latest.care_slots = [NS(**s.model_dump(), service_type='nursing') for s in payload.care_slots]
    assert service.create_version(None, payload) is latest
    service.care_need_repo.add.assert_not_called()


def test_posting_and_reading_legacy_snapshots_work_without_classification():
    slot = NS(id=uuid4(), day_of_week=WeekDay.MO, start_time=time(9), end_time=time(11))
    snapshot = PlacementService._slot_to_snapshot(slot)
    assert 'service_type' not in snapshot
    parsed = PlacementService._parse_snapshot([snapshot, dict(snapshot, service_type='nursing')])
    service = PlacementService.__new__(PlacementService)
    assert service._format_care_need(parsed) == 'Mon · 9am–11am\nMon · 9am–11am'
    assert 'service_type' not in CareSlotResponse.model_validate(slot).model_dump()


def test_old_shift_clients_can_send_classification_but_it_is_not_saved():
    shift = ShiftCreateSchema(worker_id=uuid4(), client_id=uuid4(),
        start_time=datetime(2030, 1, 7, 9), end_time=datetime(2030, 1, 7, 11),
        service_type='personal_care')
    assert 'service_type' not in shift.model_dump()


def test_care_metrics_keep_totals_without_classifications():
    service = ShiftService.__new__(ShiftService)
    service.get_shifts = AsyncMock(return_value=[
        NS(start_time=datetime(2030, 1, 7, 9), end_time=datetime(2030, 1, 7, 11),
           completion_status=ShiftCompletionStatus.completed),
        NS(start_time=datetime(2030, 1, 8, 9), end_time=datetime(2030, 1, 8, 12),
           completion_status=ShiftCompletionStatus.scheduled),
    ])
    result = asyncio.run(service.get_care_metrics(date(2030, 1, 7), date(2030, 1, 13)))
    assert CareMetricsResponse.model_validate(result).model_dump() == {
        'scheduled_shifts': 2, 'scheduled_hours': 5,
        'delivered_shifts': 1, 'delivered_hours': 2,
    }
