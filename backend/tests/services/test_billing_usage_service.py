from datetime import datetime, timezone
from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from app.core.exceptions import AppError
from app.services.billing_usage_service import BillingUsageService


def test_scope_required():
    with pytest.raises(ValueError):
        BillingUsageService(MagicMock(), None, None)


def test_service_uses_resolved_org_and_never_writes_or_calls_stripe():
    db = MagicMock()
    org = uuid4()
    service = BillingUsageService(db, None, org)
    service.usage_repo = MagicMock()
    service.usage_repo.candidates.return_value = []
    result = service.estimate(datetime(2026, 9, 1, tzinfo=timezone.utc), datetime(2026, 10, 1, tzinfo=timezone.utc), "America/St_Johns")
    assert service.usage_repo.candidates.call_args.args[0] == org
    assert result["is_estimate"] and result["active_client_count"] == 0
    assert result["clients"] == []
    db.commit.assert_not_called()
    db.add.assert_not_called()


@pytest.mark.parametrize("zone", ["", "Not/A_Zone", None])
def test_missing_or_invalid_timezone_fails_before_query(zone):
    service = BillingUsageService(MagicMock(), None, uuid4())
    service.usage_repo = MagicMock()
    with pytest.raises(AppError) as error:
        service.estimate(datetime(2026, 9, 1, tzinfo=timezone.utc), datetime(2026, 10, 1, tzinfo=timezone.utc), zone)
    assert error.value.code == "USAGE_REVIEW_REQUIRED"
    service.usage_repo.candidates.assert_not_called()
