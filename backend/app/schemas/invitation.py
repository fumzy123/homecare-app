import uuid
from datetime import datetime
from pydantic import BaseModel, EmailStr
from app.core.enums import OrgMemberRole

# Must match Supabase Authentication → Email OTP expiration setting.
# Update both here and in the Supabase dashboard together.
INVITE_EXPIRY_SECONDS = 86_400  # 24 hours


class CreateInvitationSchema(BaseModel):
    email: EmailStr
    role: OrgMemberRole


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
    accepted_at: datetime | None
