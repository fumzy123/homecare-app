from unittest.mock import MagicMock
from uuid import uuid4
import pytest
from app.core.exceptions import AppError
from app.services.trial_activation_service import TrialActivationService


@pytest.mark.parametrize("user", [None, MagicMock()])
def test_retired_manual_trial_control_has_no_side_effects(user):
    db = MagicMock()
    with pytest.raises(AppError) as error:
        TrialActivationService(db, user).request_start(uuid4())
    assert error.value.status_code == 410
    assert error.value.code == "AUTOMATIC_TRIAL"
    assert not db.mock_calls
