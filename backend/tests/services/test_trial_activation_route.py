from fastapi import FastAPI
from fastapi.testclient import TestClient
from types import SimpleNamespace
from uuid import uuid4
import pytest

from app.api.routes.billing import router
from app.core.config import settings
from app.core.security import get_current_user


@pytest.mark.parametrize("action", ["trial-activation", "founding-offer", "founding-offer/release"])
def test_agency_owner_cannot_call_operator_endpoint(monkeypatch, action):
    monkeypatch.setattr(settings, "billing_operator_user_ids", [])
    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(
        id=uuid4(), user_metadata={"role": "owner"},
    )
    response = TestClient(app).post(f"/billing/operator/organizations/{uuid4()}/{action}")
    assert response.status_code == 403
