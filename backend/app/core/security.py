from fastapi import Depends
from fastapi.security import HTTPBearer
from supabase_auth.types import User as SupabaseUser
from app.db.supabase import get_supabase_client
from app.core.enums import OrgMemberRole
from app.core.exceptions import AppError

security = HTTPBearer()


async def get_current_user(token=Depends(security)) -> SupabaseUser:
    supabase = get_supabase_client()
    try:
        response = supabase.auth.get_user(token.credentials)
        if not response or not response.user:
            raise AppError(status_code=401, code="UNAUTHORIZED", message="Invalid token")
        return response.user
    except AppError:
        raise
    except Exception:
        raise AppError(status_code=401, code="UNAUTHORIZED", message="Invalid or expired token")


async def require_admin(current_user: SupabaseUser = Depends(get_current_user)) -> SupabaseUser:
    role = current_user.user_metadata.get("role")
    if role not in [OrgMemberRole.owner, OrgMemberRole.agency_admin]:
        raise AppError(status_code=403, code="FORBIDDEN", message="Admins only")
    return current_user


async def require_owner(current_user: SupabaseUser = Depends(get_current_user)) -> SupabaseUser:
    role = current_user.user_metadata.get("role")
    if role != OrgMemberRole.owner:
        raise AppError(status_code=403, code="FORBIDDEN", message="Owners only")
    return current_user
