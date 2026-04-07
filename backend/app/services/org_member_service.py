from fastapi import HTTPException
from app.db.supabase import get_supabase_client
from app.core.enums import OrgMemberRole


class OrgMemberService:

    @staticmethod
    async def get_all_members(current_user, role: OrgMemberRole | None = None):
        supabase = get_supabase_client()
        try:
            # 1. Get the admin's organization
            admin_record = supabase.table("org_members")\
                .select("org_id")\
                .eq("id", current_user.id)\
                .single()\
                .execute()

            org_id = admin_record.data["org_id"]

            # 2. Build query for members in this organization
            query = supabase.table("org_members")\
                .select("id, first_name, last_name, email, role, is_active, created_at")\
                .eq("org_id", org_id)

            # 3. Apply optional role filter
            if role is not None:
                query = query.eq("role", role.value)

            result = query.execute()
            return result.data

        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))


    @staticmethod
    async def get_member(current_user, member_id: str):
        supabase = get_supabase_client()
        try:
            # 1. Get the admin's organization
            admin_record = supabase.table("org_members")\
                .select("org_id")\
                .eq("id", current_user.id)\
                .single()\
                .execute()

            org_id = admin_record.data["org_id"]

            # 2. Get the member — must belong to the same org (tenant isolation)
            member = supabase.table("org_members")\
                .select("id, first_name, last_name, email, role, is_active, created_at, updated_at")\
                .eq("id", member_id)\
                .eq("org_id", org_id)\
                .single()\
                .execute()

            return member.data

        except Exception as e:
            # PGRST116 = 0 rows → member not found or not in this org
            if "PGRST116" in str(e):
                raise HTTPException(status_code=404, detail="Member not found")
            raise HTTPException(status_code=400, detail=str(e))
