from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer
from supabase_auth.types import User as SupabaseUser
from app.db.supabase import get_supabase_client
from app.core.enums import OrgMemberRole

security = HTTPBearer()


async def get_current_user(token=Depends(security)) -> SupabaseUser:
    supabase = get_supabase_client()
    try:
        response = supabase.auth.get_user(token.credentials)
        if not response or not response.user:
            raise HTTPException(status_code=401, detail="Invalid token")
        return response.user
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Authentication service error")


async def require_admin(current_user: SupabaseUser = Depends(get_current_user)) -> SupabaseUser:
    role = current_user.user_metadata.get("role")
    if role not in [OrgMemberRole.owner, OrgMemberRole.agency_admin]:
        raise HTTPException(status_code=403, detail="Admins only")
    return current_user


async def require_owner(current_user: SupabaseUser = Depends(get_current_user)) -> SupabaseUser:
    role = current_user.user_metadata.get("role")
    if role != OrgMemberRole.owner:
        raise HTTPException(status_code=403, detail="Owners only")
    return current_user