from datetime import datetime, timezone
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.api.routes import legal
from app.core.enums import ADMIN_ROLES, OrgMemberRole
from app.core.exceptions import AppError, app_error_handler
from app.core.security import get_current_user
from app.db.session import get_db
from app.models import Employment, Organization, Person


@pytest.fixture
def context():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool,
    )
    for model in (Person, Organization, Employment):
        model.__table__.create(engine)
    with Session(engine) as db:
        user = SimpleNamespace(id=uuid4(), user_metadata={"role": "owner"})
        person = Person(
            id=uuid4(), supabase_user_id=user.id, first_name="Test",
            last_name="Worker", email="test@example.com",
        )
        org = Organization(id=uuid4(), owner_id=person.id, name="Test Agency")
        other_org = Organization(id=uuid4(), owner_id=uuid4(), name="Other Agency")
        employment = Employment(
            id=uuid4(), person_id=person.id, org_id=org.id,
            role=OrgMemberRole.home_support_worker,
        )
        db.add_all([person, org, other_org, employment])
        db.commit()
        app = FastAPI()
        app.include_router(legal.router, prefix="/api")
        app.add_exception_handler(AppError, app_error_handler)
        app.dependency_overrides[get_db] = lambda: db
        app.dependency_overrides[get_current_user] = lambda: user
        with TestClient(app) as client:
            yield SimpleNamespace(
                app=app, client=client, db=db, org=org, other_org=other_org,
                employment=employment,
            )
    engine.dispose()


def accept(context, version=legal.CURRENT_TERMS_VERSION):
    return context.client.post("/api/legal/accept", json={"version": version})


def test_worker_cannot_accept_agency_terms_even_with_owner_metadata(context):
    assert accept(context).status_code == 403
    context.db.refresh(context.org)
    assert context.org.terms_accepted_at is None
    assert context.org.terms_accepted_version is None


@pytest.mark.parametrize("role", ADMIN_ROLES)
def test_admin_acceptance_updates_only_their_own_agency(context, role):
    context.employment.role = role
    context.db.commit()
    response = context.client.post(
        f"/api/legal/accept?org_id={context.other_org.id}",
        json={"version": legal.CURRENT_TERMS_VERSION, "org_id": str(context.other_org.id)},
    )
    assert response.status_code == 200
    assert response.json()["accepted"] is True
    context.db.refresh(context.org)
    context.db.refresh(context.other_org)
    assert context.org.terms_accepted_version == legal.CURRENT_TERMS_VERSION
    assert context.org.terms_accepted_at is not None
    assert context.other_org.terms_accepted_version is None
    assert context.other_org.terms_accepted_at is None


def test_removed_admin_cannot_accept(context):
    context.employment.role = OrgMemberRole.owner
    context.employment.deleted_at = datetime.now(timezone.utc)
    context.db.commit()
    assert accept(context).status_code == 403
    context.db.refresh(context.org)
    assert context.org.terms_accepted_at is None


def test_missing_membership_cannot_accept(context):
    context.db.delete(context.employment)
    context.db.commit()
    assert accept(context).status_code == 403


def test_anonymous_request_cannot_accept(context):
    del context.app.dependency_overrides[get_current_user]
    assert accept(context).status_code == 401
    context.db.refresh(context.org)
    assert context.org.terms_accepted_at is None


def test_wrong_terms_version_does_not_record_acceptance(context):
    context.employment.role = OrgMemberRole.owner
    context.db.commit()
    assert accept(context, "outdated-version").status_code == 400
    context.db.refresh(context.org)
    assert context.org.terms_accepted_version is None


def test_worker_can_still_read_terms_status(context):
    response = context.client.get("/api/legal/status")
    assert response.status_code == 200
    assert response.json() == {
        "accepted": False, "accepted_version": None,
        "current_version": legal.CURRENT_TERMS_VERSION,
    }
