"""Operator-reviewed instructions, not a worker-facing deletion endpoint."""
from datetime import date
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

ProfileField = Literal[
    "phone_number", "gender", "date_of_birth", "street", "city", "province",
    "postal_code", "languages", "pet_tolerance", "preferred_client_types",
    "emergency_contact_name", "emergency_contact_phone", "emergency_contact_relationship",
]
RETENTION_CATEGORIES = {
    "remaining_profile", "employment_and_care", "credentials",
    "agency_history", "providers_and_backups",
}


class RetentionDecision(BaseModel):
    model_config = ConfigDict(extra="forbid")
    category: Literal[
        "remaining_profile", "employment_and_care", "credentials",
        "agency_history", "providers_and_backups",
    ]
    reason: str = Field(min_length=10, max_length=1000)
    # A review date is required even where a legal hold has no known end date.
    review_on: date


class AccountDeletionPlan(BaseModel):
    model_config = ConfigDict(extra="forbid")
    person_id: UUID
    expected_auth_user_id: UUID
    expected_employment_ids: list[UUID] = Field(min_length=1)
    request_reference: str = Field(pattern=r"^[A-Za-z0-9_-]{3,80}$")
    operator_reference: str = Field(pattern=r"^[A-Za-z0-9_-]{3,80}$")
    identity_verified: bool = False
    agency_reviewed: bool = False
    remove_profile_fields: list[ProfileField] = Field(default_factory=list)
    remove_availability: bool = False
    replace_email: bool = False
    retention: list[RetentionDecision]

    @model_validator(mode="after")
    def review_is_explicit(self):
        categories = [item.category for item in self.retention]
        if set(categories) != RETENTION_CATEGORIES or len(categories) != len(RETENTION_CATEGORIES):
            raise ValueError("Provide one retention decision for each retained-data category")
        if len(set(self.expected_employment_ids)) != len(self.expected_employment_ids):
            raise ValueError("Employment IDs must be unique")
        if len(set(self.remove_profile_fields)) != len(self.remove_profile_fields):
            raise ValueError("Profile fields must be unique")
        return self
