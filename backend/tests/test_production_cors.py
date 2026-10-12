import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.mark.parametrize("origin", [
    "https://www.careharbor.online",
    "https://careharbor.online",
    "https://homecare-app-production-admin-frontend.vercel.app",
])
def test_production_websites_can_send_authenticated_requests(origin):
    # No lifespan or authenticated API request: only exercise CORS preflight.
    response = TestClient(app).options("/api/legal/status", headers={
        "Origin": origin,
        "Access-Control-Request-Method": "GET",
        "Access-Control-Request-Headers": "authorization,content-type",
    })
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == origin
    assert response.headers["access-control-allow-credentials"] == "true"


def test_lookalike_domain_is_not_allowed():
    response = TestClient(app).options("/api/legal/status", headers={
        "Origin": "https://www.careharbor.online.attacker.example",
        "Access-Control-Request-Method": "GET",
    })
    assert response.status_code == 400
    assert "access-control-allow-origin" not in response.headers
