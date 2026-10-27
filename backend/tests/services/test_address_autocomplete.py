import asyncio
from types import SimpleNamespace

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.routes.addresses import router
from app.core.exceptions import AppError, app_error_handler
from app.core.security import require_admin
from app.services import address_service as module
from app.core.address_privacy import scrub_address_lookup


@pytest.fixture
def provider(monkeypatch):
    monkeypatch.setattr(module.settings, "geoapify_api_key", "secret-test-key")
    monkeypatch.setattr(module, "lookup_budget", module.AddressLookupBudget())
    original = httpx.AsyncClient
    requests = []

    def configure(payload=None, status=200, error=None):
        def handler(request):
            requests.append(request)
            if error:
                raise error
            return httpx.Response(status, json=payload)
        monkeypatch.setattr(module.httpx, "AsyncClient", lambda **kwargs: original(
            transport=httpx.MockTransport(handler), **kwargs))
        return requests
    return configure


def search(text="100 Demo"):
    return asyncio.run(module.AddressService(SimpleNamespace(id="admin")).search(text))


def test_canadian_structured_results_and_deduplication(provider):
    address = {"country_code": "ca", "formatted": "100 Demo Street, St. John's, NL",
               "housenumber": "100", "street": "Demo Street", "city": "St. John's",
               "state_code": "CA-NL", "postcode": "A1A1A1"}
    requests = provider({"results": [address, address, {"country_code": "us"}]})
    result = search()
    assert len(result.suggestions) == 1
    assert result.suggestions[0].model_dump() == {
        "label": address["formatted"], "street": "100 Demo Street",
        "city": "St. John's", "province": "NL", "postal_code": "A1A1A1",
    }
    assert requests[0].url.params["filter"] == "countrycode:ca"
    assert requests[0].url.params["limit"] == "5"
    assert "secret-test-key" not in result.model_dump_json()


def test_rural_and_incomplete_results_do_not_invent_components(provider):
    provider({"results": [{"country_code": "ca", "street": "Demo Road",
                          "formatted": "Demo Road, Yukon", "village": "Demo Village",
                          "state": "Yukon"}]})
    result = search().suggestions[0]
    assert result.province == "YT"
    assert result.city == "Demo Village"
    assert result.postal_code == ""
    assert result.street == "Demo Road"


@pytest.mark.parametrize("status", [401, 429, 500])
def test_provider_failures_do_not_leak_key_or_payload(provider, status):
    provider({"error": "secret-test-key"}, status)
    with pytest.raises(AppError) as error:
        search()
    assert error.value.status_code == 503
    assert "secret-test-key" not in error.value.message
    assert error.value.details is None


def test_timeout_and_malformed_response(provider):
    provider(error=httpx.ReadTimeout("secret-test-key"))
    with pytest.raises(AppError) as error:
        search()
    assert error.value.code == "ADDRESS_LOOKUP_UNAVAILABLE"
    provider({"results": None})
    with pytest.raises(AppError):
        search()


def test_missing_key_does_not_call_provider(provider, monkeypatch):
    requests = provider({"results": []})
    monkeypatch.setattr(module.settings, "geoapify_api_key", "")
    with pytest.raises(AppError):
        search()
    assert requests == []


def test_daily_and_burst_budget_shared_across_accounts():
    budget = module.AddressLookupBudget()
    budget.reserve("a", 2, 0)
    budget.reserve("b", 2, 2)
    with pytest.raises(AppError) as error:
        budget.reserve("c", 2, 3)
    assert error.value.status_code == 429
    budget.reserve("c", 2, 86401)
    budget = module.AddressLookupBudget()
    for i in range(4):
        budget.reserve(str(i), 2500, 0)
    with pytest.raises(AppError):
        budget.reserve("other-account", 2500, 0.5)
    budget.reserve("other-account", 2500, 1)


def test_per_user_limit_and_disabled_budget():
    budget = module.AddressLookupBudget()
    for i in range(30):
        budget.reserve("a", 2500, i)
    with pytest.raises(AppError):
        budget.reserve("a", 2500, 31)
    budget.reserve("b", 2500, 31)
    with pytest.raises(AppError):
        module.AddressLookupBudget().reserve("a", 0, 0)


def test_route_requires_admin_and_validates_search(provider):
    requests = provider({"results": []})
    app = FastAPI()
    app.add_exception_handler(AppError, app_error_handler)
    app.include_router(router, prefix="/api")
    client = TestClient(app)
    assert client.post("/api/addresses/autocomplete", json={"text": "Demo"}).status_code in (401, 403)
    app.dependency_overrides[require_admin] = lambda: SimpleNamespace(id="admin")
    for text in ["ab", "  ", "a" * 201]:
        assert client.post("/api/addresses/autocomplete", json={"text": text}).status_code == 422
    assert requests == []
    response = client.post("/api/addresses/autocomplete", json={"text": "  Demo Street  "})
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    assert requests[0].url.params["text"] == "Demo Street"


def test_telemetry_removes_address_queries_and_keys():
    event = {"spans": [{"data": {"url": "https://api.geoapify.com/v1/geocode/autocomplete",
                                "http.query": "text=private-address&apiKey=secret"}}],
             "breadcrumbs": [{"message": 'GET https://api.geoapify.com/v1/geocode/autocomplete?apiKey=secret&text=private-address 200'}]}
    result = str(scrub_address_lookup(event))
    assert "secret" not in result
    assert "private-address" not in result
