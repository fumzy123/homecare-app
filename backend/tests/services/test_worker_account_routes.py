from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.routes import worker_me
from app.core.exceptions import AppError, app_error_handler
from app.core.security import get_current_user
from app.db.session import get_db


@pytest.fixture
def context(monkeypatch):
    app = FastAPI()
    app.include_router(worker_me.router, prefix="/api")
    app.add_exception_handler(AppError, app_error_handler)
    db = MagicMock()
    app.dependency_overrides[get_db] = lambda: db
    constructor = MagicMock()
    monkeypatch.setattr(worker_me, "WorkerAccountService", constructor)
    return SimpleNamespace(app=app, client=TestClient(app), db=db, constructor=constructor)


def test_account_endpoint_requires_a_session(context):
    response = context.client.get("/api/me/account")
    assert response.status_code == 401
    context.constructor.assert_not_called()


def test_invited_user_can_check_setup_before_becoming_a_worker(context):
    user = SimpleNamespace(id=uuid4(), email="worker@example.com")
    context.app.dependency_overrides[get_current_user] = lambda: user
    context.constructor.return_value.get_account.return_value = {
        "status": "pending", "email": user.email, "org_name": "Test Agency",
    }
    response = context.client.get(f"/api/me/account?user_id={uuid4()}")
    assert response.status_code == 200
    assert response.json()["status"] == "pending"
    context.constructor.assert_called_once_with(context.db, user)


def test_expired_invitation_is_not_returned_as_pending(context):
    user = SimpleNamespace(id=uuid4(), email="worker@example.com")
    context.app.dependency_overrides[get_current_user] = lambda: user
    context.constructor.return_value.get_account.return_value = {
        "status": "expired", "email": user.email,
    }
    response = context.client.get("/api/me/account")
    assert response.status_code == 200
    assert response.json()["status"] == "expired"
