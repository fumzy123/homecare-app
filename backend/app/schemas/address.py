from typing import Annotated

from pydantic import BaseModel, StringConstraints


class AddressSearch(BaseModel):
    text: Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=200)]


class AddressSuggestion(BaseModel):
    label: str
    street: str
    city: str
    province: str
    postal_code: str


class AddressSearchResponse(BaseModel):
    suggestions: list[AddressSuggestion]
