from datetime import date, time, timedelta
from types import SimpleNamespace as NS
from unittest.mock import MagicMock
import pytest
from app.core.enums import CareArrangement, WeekDay, ServiceType
from app.schemas.weekly_care_need import WeeklyCareNeedCreate
from app.services.weekly_care_need_service import WeeklyCareNeedService


def setup_save(effective=None):
    payload = WeeklyCareNeedCreate(
        effective_from=effective or date.today() + timedelta(days=10),
        care_slots=[
            dict(day_of_week=day, start_time="09:00", end_time="17:00",
                 service_type="personal_care")
            for day in ["MO", "WE"]
        ],
    )
    latest = NS(
        id="existing", effective_from=payload.effective_from,
        care_slots=list(reversed(payload.care_slots)), version=2,
        activated_at=None, ends_on=None,
    )
    service = WeeklyCareNeedService.__new__(WeeklyCareNeedService)
    service.db = MagicMock()
    service.org_id = "agency"
    service.member = NS(id=None)
    service.org_repo = MagicMock()
    service.org_repo.lock_by_id.return_value = NS(billing_timezone="America/St_Johns")
    service.client_repo = MagicMock()
    service.client_repo.get_active_client.return_value = NS(care_arrangement=CareArrangement.self_pay)
    service.care_need_repo = MagicMock()
    service.care_need_repo.latest.return_value = latest
    service.care_need_repo.versions.return_value = []
    return service, payload, latest


@pytest.mark.parametrize("approved", [False, True])
def test_identical_save_preserves_existing_version_and_placement(approved):
    service, payload, latest = setup_save()
    latest.activated_at = date.today() if approved else None
    latest.scheduled_from = latest.effective_from
    assert service.create_version(None, payload) is latest
    service.care_need_repo.add.assert_not_called()
    service.db.flush.assert_not_called()
    service.db.commit.assert_called_once()
    service.org_repo.lock_by_id.assert_called_once()


def test_retry_after_effective_date_is_still_noop():
    service, payload, latest = setup_save(date.today() - timedelta(days=1))
    assert service.create_version(None, payload) is latest
    service.care_need_repo.add.assert_not_called()


@pytest.mark.parametrize("field,value", [
    ("effective_from", date.today() + timedelta(days=11)),
    ("start_time", time(10)),
    ("end_time", time(16)),
    ("day_of_week", WeekDay.FR),
    ("service_type", ServiceType.respite),
])
def test_meaningful_change_creates_version(field, value):
    service, payload, latest = setup_save()
    # An active baseline avoids proposal notification collaborators in this unit test.
    latest.activated_at = date.today()
    latest.scheduled_from = date.today()
    payload = payload.model_copy(deep=True)
    if field == "effective_from":
        payload.effective_from = value
    else:
        setattr(payload.care_slots[0], field, value)
    result = service.create_version(None, payload)
    assert result.version == 3
    service.care_need_repo.add.assert_called_once_with(result)
