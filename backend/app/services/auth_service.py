from fastapi import HTTPException
from supabase import create_client
from gotrue.types import User as SupabaseUser
from app.db.supabase import get_supabase_client
from app.core.config import settings
from app.schemas.auth import InviteUserSchema, SignInSchema


class AuthService:

    @staticmethod
    async def invite_user(payload: InviteUserSchema, current_user: SupabaseUser):
        supabase = get_supabase_client()
        try:
            # Get the inviting admin/owner's org
            admin_record = supabase.table("org_members")\
                .select("org_id")\
                .eq("id", current_user.id)\
                .single()\
                .execute()

            org_id = admin_record.data["org_id"]

            # 1. Create the user in Supabase Auth and send the invite email
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

            # 2. Create the org_members record linking this user to the organization
            supabase.table("org_members").insert({
                "id": invited_user.id,
                "first_name": payload.first_name,
                "last_name": payload.last_name,
                "email": payload.email,
                "role": payload.role.value,
                "org_id": org_id
            }).execute()

            return {"message": f"Invite sent to {payload.email} as {payload.role}"}

        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))


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
            raise HTTPException(status_code=401, detail="Invalid email or password")


    @staticmethod
    async def sign_out(token: str):
        supabase = get_supabase_client()
        try:
            supabase.auth.admin.sign_out(token)
            return {"message": "Signed out successfully"}
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))
