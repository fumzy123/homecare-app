from supabase_auth.types import User as SupabaseUser
from app.db.supabase import get_supabase_client
from app.core.exceptions import AppError
from app.schemas.auth import InviteUserSchema
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


