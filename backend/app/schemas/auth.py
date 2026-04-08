from pydantic import BaseModel, EmailStr
from app.core.enums import OrgMemberRole


class InviteUserSchema(BaseModel):
    email: EmailStr
    first_name: str
    last_name: str
    role: OrgMemberRole


class SignInSchema(BaseModel):
    email: EmailStr
    password: str
