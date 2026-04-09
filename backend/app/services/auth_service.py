from supabase import create_client
from supabase_auth.types import User as SupabaseUser
from app.db.supabase import get_supabase_client
from app.core.config import settings
from app.core.exceptions import AppError
from app.schemas.auth import InviteUserSchema, SignInSchema
from app.core.enums import OrgMemberRole


class AuthService:

    @staticmethod
    async def invite_user(payload: InviteUserSchema, current_user: SupabaseUser):
        supabase = get_supabase_client()
        try:
            admin_record = supabase.table("org_members")\
                .select("org_id")\
                .eq("id", current_user.id)\
                .single()\
                .execute()

            org_id = admin_record.data["org_id"]

            invite_response = supabase.auth.admin.invite_user_by_email(
                payload.email,
                options={
                    "data": {
                        "first_name": payload.first_name,
                        "last_name": payload.last_name,
                        "role": payload.role,
                        "org_id": org_id
                    }
                }
            )

            invited_user = invite_response.user

            supabase.table("org_members").insert({
                "id": invited_user.id,
                "first_name": payload.first_name,
                "last_name": payload.last_name,
                "email": payload.email,
                "role": payload.role.value,
                "org_id": org_id
            }).execute()

            if payload.role == OrgMemberRole.home_support_worker:
                supabase.table("worker_profiles").insert({
                    "org_member_id": invited_user.id
                }).execute()

            return {"message": f"Invite sent to {payload.email} as {payload.role}"}

        except AppError:
            raise
        except Exception as e:
            raise AppError(status_code=400, code="BAD_REQUEST", message=str(e))


    @staticmethod
    async def sign_in(payload: SignInSchema):
        # IMPORTANT: sign_in_with_password mutates the client's internal auth state.
        # We MUST use a disposable client here to avoid contaminating the shared
        # Service Role singleton — otherwise all subsequent admin queries would
        # run as this user instead of as the service role, and RLS would block them.
        temp_client = create_client(settings.supabase_url, settings.supabase_key)
        try:
            response = temp_client.auth.sign_in_with_password({
                "email": payload.email,
                "password": payload.password
            })

            return {
                "access_token": response.session.access_token,
                "refresh_token": response.session.refresh_token,
                "user": {
                    "id": response.user.id,
                    "email": response.user.email,
                    "first_name": response.user.user_metadata.get("first_name"),
                    "last_name": response.user.user_metadata.get("last_name"),
                    "role": response.user.user_metadata.get("role"),
                }
            }

        except Exception:
            raise AppError(status_code=401, code="UNAUTHORIZED", message="Invalid email or password")


    @staticmethod
    async def sign_out(token: str):
        supabase = get_supabase_client()
        try:
            supabase.auth.admin.sign_out(token)
            return {"message": "Signed out successfully"}
        except Exception as e:
            raise AppError(status_code=400, code="BAD_REQUEST", message=str(e))
