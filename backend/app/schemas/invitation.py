import uuid
from datetime import datetime
from pydantic import BaseModel, EmailStr, field_validator
from app.core.enums import OrgMemberRole, EmploymentType

# Must match Supabase Authentication → Email OTP expiration setting.
# Update both here and in the Supabase dashboard together.
INVITE_EXPIRY_SECONDS = 86_400  # 24 hours


class CreateInvitationSchema(BaseModel):
    email:           EmailStr
    role:            OrgMemberRole
    employment_type: EmploymentType

    @field_validator("role")
    @classmethod
    def role_cannot_be_owner(cls, v: OrgMemberRole) -> OrgMemberRole:
        if v == OrgMemberRole.owner:
            raise ValueError("Cannot invite someone as owner")
        return v


class AcceptInvitationSchema(BaseModel):
    first_name: str
    last_name: str


class InvitationResponse(BaseModel):
    id: uuid.UUID
    email: str
    role: OrgMemberRole
    org_id: uuid.UUID
    invited_by: uuid.UUID
    invited_at: datetime
    expires_at: datetime  # computed from invited_at — not stored in DB
