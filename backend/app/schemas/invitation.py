from pydantic import BaseModel, EmailStr
from app.core.enums import OrgMemberRole


class CreateInvitationSchema(BaseModel):
    email: EmailStr
    role: OrgMemberRole


class AcceptInvitationSchema(BaseModel):
    first_name: str
    last_name: str
