"""Opt-in browser -> real FastAPI routes -> isolated PostgreSQL workflow.

Run Vite with dummy public settings, set CARE_REQUEST_TEST_URL and
CARE_TEST_DATABASE_URL (an initialized *_test database), and install Playwright
or set PLAYWRIGHT_MODULE. Identity, billing and unrelated shell reads are fixtures.
Coverage and history use real routes/services; roster and care-need fixture reads
come from the same isolated database.
"""

import json
import os
from pathlib import Path
import socket
import subprocess
import threading
import time

from fastapi import FastAPI
from fastapi.encoders import jsonable_encoder
import pytest
import uvicorn

from app.api.routes import placements, assignments
from app.core.exceptions import AppError, app_error_handler
from app.models.placement import CareSlotAssignment, PlacementInterest
from app.models.shift import Shift
from app.schemas.weekly_care_need import WeeklyCareNeedResponse
from app.services.assignment_service import AssignmentService
from app.core.enums import EmploymentStatus
from tests.integration.test_care_coverage import scenario, direct_payload  # noqa: F401


@pytest.mark.parametrize("entry", ["request", "client"])
def test_direct_assignment_browser(scenario, tmp_path, entry):  # noqa: F811
    if not os.getenv("CARE_REQUEST_TEST_URL"):
        pytest.skip("Requires local Vite and Playwright")
    s = scenario
    direct_payload(s)  # Remove all interest; no worker app participates.
    s.members[3].max_hours_per_week = 1
    s.db.commit()
    app = FastAPI()
    app.add_exception_handler(AppError, app_error_handler)
    app.include_router(placements.router, prefix="/api")
    app.include_router(assignments.router, prefix="/api")
    # One transaction-backed Session; serialize requests from browser refreshes.
    lock = threading.Lock()

    def placement_service():
        with lock:
            yield s.service

    def assignment_service():
        with lock:
            yield AssignmentService(s.db, s.service.current_user, s.service.org_id)

    app.dependency_overrides[placements.get_placement_service] = placement_service
    app.dependency_overrides[assignments.get_assignment_service] = assignment_service

    @app.get("/api/org-members")
    def roster():
        with lock:
            return [
                dict(
                    id=str(w.id),
                    first_name=w.person.first_name,
                    last_name=w.person.last_name,
                    is_active=w.employment_status == EmploymentStatus.active,
                    employment_status=w.employment_status.value,
                    max_hours_per_week=w.max_hours_per_week,
                )
                for w in s.members[1:]
            ]

    @app.get("/api/clients/{client_id}/care-need")
    def needs(client_id: str):
        with lock:
            s.db.expire_all()
            return [WeeklyCareNeedResponse.model_validate(n) for n in (s.need, s.old)]

    data = dict(
        entry=entry,
        request_id=str(s.placement.id),
        client_id=str(s.client.id),
        org_id=str(s.service.org_id),
        user_id=str(s.service.current_user.id),
        workers=[str(w.id) for w in s.members[1:]],
        starts_on=str(s.start),
    )
    data["client"] = jsonable_encoder(
        {c.name: getattr(s.client, c.name) for c in s.client.__table__.columns}
    )
    sock = socket.socket()
    sock.bind(("127.0.0.1", 0))
    data["api"] = f"http://127.0.0.1:{sock.getsockname()[1]}"
    server = uvicorn.Server(uvicorn.Config(app, log_level="warning"))
    thread = threading.Thread(
        target=server.run, kwargs={"sockets": [sock]}, daemon=True
    )
    thread.start()
    try:
        deadline = time.monotonic() + 10
        while not server.started and time.monotonic() < deadline:
            time.sleep(0.05)
        assert server.started
        fixture = tmp_path / "browser-fixture.json"
        fixture.write_text(json.dumps(data), encoding="utf-8")
        script = (
            Path(__file__).resolve().parents[3]
            / "admin-frontend/tests/direct-assignment.browser.cjs"
        )
        result = subprocess.run(
            ["node", str(script), str(fixture)],
            capture_output=True,
            text=True,
            timeout=150,
            env=os.environ.copy(),
        )
        assert result.returncode == 0, result.stdout + result.stderr
        s.db.expire_all()
        rows = s.db.query(CareSlotAssignment).all()
        assert len(rows) == 3 and all(
            a.assignment_source == "admin_arranged" for a in rows
        )
        assert (
            s.db.query(PlacementInterest).filter_by(placement_id=s.placement.id).count()
            == 0
        )
        assert s.db.query(Shift).filter_by(weekly_care_need_id=s.need.id).count() == 3
        assert s.service.get_placement(s.placement.id).covered_count == 3
    finally:
        server.should_exit = True
        thread.join(timeout=10)
        sock.close()
