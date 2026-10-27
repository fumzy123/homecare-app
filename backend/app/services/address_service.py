"""Canadian address lookup. No client records or provider payloads are persisted."""
from collections import deque
from threading import Lock
from time import monotonic
import asyncio

import httpx

from app.core.config import settings
from app.core.exceptions import AppError
from app.schemas.address import AddressSearchResponse, AddressSuggestion


PROVINCES = {
    "Alberta": "AB", "British Columbia": "BC", "Manitoba": "MB",
    "New Brunswick": "NB", "Newfoundland and Labrador": "NL",
    "Nova Scotia": "NS", "Northwest Territories": "NT", "Nunavut": "NU",
    "Ontario": "ON", "Prince Edward Island": "PE", "Quebec": "QC",
    "Québec": "QC", "Saskatchewan": "SK", "Yukon": "YT",
}


class AddressLookupBudget:
    """Process-wide rolling limits, shared by all accounts, including failed calls.

    Current deployment is single-process. Restart resets this budget; multiple
    replicas require shared persistent counters before enabling lookup there.
    """

    def __init__(self):
        self._calls = deque()
        self._lock = Lock()

    def reserve(self, user_id: str, daily_limit: int, now: float | None = None):
        now = monotonic() if now is None else now
        with self._lock:
            while self._calls and self._calls[0][0] <= now - 86400:
                self._calls.popleft()
            if (len(self._calls) >= daily_limit
                    or sum(t > now - 1 for t, _ in self._calls) >= 4
                    or sum(t > now - 60 and u == user_id for t, u in self._calls) >= 30):
                raise AppError(429, "ADDRESS_LOOKUP_LIMIT", "Address suggestions are temporarily limited. Enter the address manually.")
            self._calls.append((now, user_id))


lookup_budget = AddressLookupBudget()


class AddressService:
    def __init__(self, current_user):
        self.user_id = str(current_user.id)

    async def search(self, text: str) -> AddressSearchResponse:
        if not settings.geoapify_api_key:
            raise AppError(503, "ADDRESS_LOOKUP_UNAVAILABLE", "Address suggestions are unavailable. Enter the address manually.")
        lookup_budget.reserve(self.user_id, settings.address_lookup_daily_limit)
        try:
            async with asyncio.timeout(10), httpx.AsyncClient(timeout=8.0) as client:
                response = await client.get(
                    "https://api.geoapify.com/v1/geocode/autocomplete",
                    params={"text": text, "filter": "countrycode:ca",
                            "format": "json", "limit": 5, "lang": "en",
                            "apiKey": settings.geoapify_api_key},
                )
                response.raise_for_status()
                payload = response.json()
            suggestions = []
            seen = set()
            for item in payload["results"]:
                if item.get("country_code", "").lower() != "ca" or not item.get("street"):
                    continue
                province = item.get("state_code", "").removeprefix("CA-")
                if province not in PROVINCES.values():
                    province = PROVINCES.get(item.get("state"), "")
                suggestion = AddressSuggestion(
                    label=item["formatted"],
                    street=" ".join(filter(None, [item.get("housenumber"), item["street"]])),
                    city=item.get("city") or item.get("town") or item.get("village") or item.get("municipality") or "",
                    province=province,
                    postal_code=item.get("postcode") or "",
                )
                if suggestion.label not in seen:
                    suggestions.append(suggestion)
                    seen.add(suggestion.label)
            return AddressSearchResponse(suggestions=suggestions)
        except (httpx.HTTPError, TimeoutError, ValueError, KeyError, TypeError, AttributeError):
            # Never expose the upstream URL (contains the key and typed address).
            raise AppError(503, "ADDRESS_LOOKUP_UNAVAILABLE", "Address suggestions are unavailable. Enter the address manually.") from None
