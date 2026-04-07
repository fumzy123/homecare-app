from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer
from app.db.supabase import get_supabase_client

security = HTTPBearer()

async def get_current_user(token=Depends(security)):
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


async def require_admin(current_user=Depends(get_current_user)):
    role = current_user.user_metadata.get("role")
    if role not in ["owner", "agency_admin"]:
        raise HTTPException(status_code=403, detail="Admins only")
    return current_user


async def require_owner(current_user=Depends(get_current_user)):
    role = current_user.user_metadata.get("role")
    if role != "owner":
        raise HTTPException(status_code=403, detail="Owners only")
    return current_user