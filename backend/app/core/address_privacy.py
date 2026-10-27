"""Remove address-search query text and provider keys from outgoing telemetry."""
import re

_PROVIDER_URL = re.compile(r"https://api\.geoapify\.com/[^\s\"'<>]*")


def scrub_address_lookup(value):
    if isinstance(value, dict):
        if "api.geoapify.com" in str(value.get("url", "")):
            value.pop("http.query", None)
            value.pop("query_string", None)
        for key in list(value):
            value[key] = scrub_address_lookup(value[key])
    elif isinstance(value, list):
        for index, item in enumerate(value):
            value[index] = scrub_address_lookup(item)
    elif isinstance(value, str):
        return _PROVIDER_URL.sub("https://api.geoapify.com/[address-lookup]", value)
    return value
