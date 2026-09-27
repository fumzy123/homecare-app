from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.routes import billing
from app.core import security
from app.core.enums import OrgMemberRole
from app.core.exceptions import AppError, app_error_handler
from app.db.session import get_db


@pytest.fixture
def context(monkeypatch):
    app = FastAPI()
    app.include_router(billing.router)
    app.add_exception_handler(AppError, app_error_handler)
    user, org, db = SimpleNamespace(id=uuid4()), uuid4(), MagicMock()
    employment = SimpleNamespace(role=OrgMemberRole.owner)
    app.dependency_overrides[security.get_current_user] = lambda: user
    app.dependency_overrides[get_db] = lambda: db
    monkeypatch.setattr(security, "_get_active_employment", lambda *_: employment)
    monkeypatch.setattr(billing.OrgService, "get_user_org_id", lambda *_: org)
    constructor = MagicMock()
    constructor.return_value.set_timezone.return_value = {"billing_timezone": "UTC"}
    constructor.return_value.current.return_value = {"state": "not_started", "usage": None}
    monkeypatch.setattr(billing, "BillingUsageService", constructor)
    return SimpleNamespace(client=TestClient(app), user=user, org=org, db=db, employment=employment, constructor=constructor)


def test_owner_can_save_timezone_for_resolved_agency_only(context):
    response = context.client.put("/billing/timezone", json={"timezone": "UTC", "org_id": str(uuid4())})
    assert response.status_code == 200
    context.constructor.assert_called_once_with(context.db, context.user, context.org)
    context.constructor.return_value.set_timezone.assert_called_once_with("UTC")


def test_admin_reads_current_usage_without_selecting_dates_or_tenant(context):
    context.employment.role = OrgMemberRole.manager
    response = context.client.get(f"/billing/usage/current?org_id={uuid4()}&period_start=2000-01-01")
    assert response.status_code == 200
    context.constructor.assert_called_once_with(context.db, context.user, context.org)
    context.constructor.return_value.current.assert_called_once_with()


@pytest.mark.parametrize("role", [OrgMemberRole.manager, OrgMemberRole.home_support_worker])
def test_nonowners_cannot_change_timezone(context, role):
    context.employment.role = role
    assert context.client.put("/billing/timezone", json={"timezone": "UTC"}).status_code == 403
    context.constructor.assert_not_called()


def test_worker_cannot_read_agency_usage(context):
    context.employment.role = OrgMemberRole.home_support_worker
    assert context.client.get("/billing/usage/current").status_code == 403
    context.constructor.assert_not_called()
