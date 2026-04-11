from pydantic import BaseModel, EmailStr
from app.core.enums import OrgMemberRole


class InviteUserSchema(BaseModel):
    email: EmailStr
    role: OrgMemberRole


class AcceptInviteSchema(BaseModel):
    first_name: str
    last_name: str
