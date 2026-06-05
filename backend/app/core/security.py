from fastapi import Depends
from fastapi.security import HTTPBearer
from sqlalchemy.orm import Session
from supabase_auth.types import User as SupabaseUser
from app.db.supabase import get_supabase_client
from app.db.session import get_db
from app.models.person import Person
from app.models.employment import Employment
from app.core.enums import OrgMemberRole, ADMIN_ROLES  # noqa: F401  (re-exported for callers)
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


def _get_active_employment(current_user: SupabaseUser, db: Session) -> Employment | None:
    person = db.query(Person).filter(
        Person.supabase_user_id == current_user.id
    ).first()
    if not person:
        return None
    return db.query(Employment).filter(
        Employment.person_id == person.id,
        Employment.deleted_at.is_(None),
    ).first()


async def require_admin(
    current_user: SupabaseUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SupabaseUser:
    employment = _get_active_employment(current_user, db)
    if not employment or employment.role not in ADMIN_ROLES:
        raise AppError(status_code=403, code="FORBIDDEN", message="Admins only")
    return current_user


async def require_owner(
    current_user: SupabaseUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SupabaseUser:
    employment = _get_active_employment(current_user, db)
    if not employment or employment.role != OrgMemberRole.owner:
        raise AppError(status_code=403, code="FORBIDDEN", message="Owners only")
    return current_user
