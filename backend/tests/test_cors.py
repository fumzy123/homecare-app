"""Deployment previews may call the API only from the application's Vercel team."""
import pytest
from fastapi.testclient import TestClient
from app.main import app


@pytest.mark.parametrize("origin,allowed", [
    ("https://homecare-nhqwo6jbi-fumezs-projects.vercel.app", True),
    ("https://homecare-app-git-staging-fumezs-projects.vercel.app", True),
    ("https://www.careharbor.online", True),
    ("https://homecare-app-malicious.vercel.app", False),
    ("https://homecare-preview-other-team.vercel.app", False),
    ("https://homecare-test-fumezs-projects.vercel.app.evil.example", False),
])
def test_preview_preflight_is_scoped_to_project_team(origin, allowed):
    response = TestClient(app).options("/api/me", headers={
        "Origin": origin,
        "Access-Control-Request-Method": "GET",
        "Access-Control-Request-Headers": "authorization",
    })
    assert response.status_code == (200 if allowed else 400)
    assert response.headers.get("access-control-allow-origin") == (origin if allowed else None)
