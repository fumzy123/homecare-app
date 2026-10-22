"""Shared write-time phone validation; response schemas preserve legacy data."""
import re
from typing import Annotated

import phonenumbers
from pydantic import BeforeValidator


def normalize_phone(value):
    if value is None or (isinstance(value, str) and not value.strip()):
        return None
    message = "Enter a valid phone number; use + and the country code outside Canada"
    if not isinstance(value, str) or not re.fullmatch(r"\+?[0-9\s().-]+", value.strip()):
        raise ValueError(message)
    try:
        number = phonenumbers.parse(value.strip(), "CA")
    except phonenumbers.NumberParseException:
        raise ValueError(message) from None
    if number.extension or not phonenumbers.is_valid_number(number):
        raise ValueError(message)
    return phonenumbers.format_number(number, phonenumbers.PhoneNumberFormat.E164)


def required_phone(value):
    result = normalize_phone(value)
    if result is None:
        raise ValueError("Phone number is required")
    return result


OptionalPhone = Annotated[str | None, BeforeValidator(normalize_phone)]
RequiredPhone = Annotated[str, BeforeValidator(required_phone)]
