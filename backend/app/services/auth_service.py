from supabase_auth.types import User as SupabaseUser
from app.db.supabase import get_supabase_client
from app.core.exceptions import AppError
from app.schemas.auth import InviteUserSchema


class AuthService:

    @staticmethod
    async def invite_user(payload: InviteUserSchema, current_user: SupabaseUser):
        supabase = get_supabase_client()
        try:
            # Resolve the admin's org_id
            admin_record = supabase.table("org_members")\
                .select("org_id")\
                .eq("id", current_user.id)\
                .single()\
                .execute()

            org_id = admin_record.data["org_id"]

            # Send invite email only — bake role + org_id into metadata
            # The invited user will create their org_member record on acceptance
            supabase.auth.admin.invite_user_by_email(
                payload.email,
                options={
                    "data": {
                        "role": payload.role,
                        "org_id": org_id,
                    }
                }
            )

            return {"message": f"Invite sent to {payload.email}"}

        except AppError:
            raise
        except Exception as e:
            raise AppError(status_code=400, code="BAD_REQUEST", message=str(e))


