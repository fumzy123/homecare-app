from fastapi import HTTPException
from sqlalchemy.orm import Session
from supabase_auth.types import User as SupabaseUser
from app.models.org_member import OrgMember
from app.models.organization import Organization
from app.schemas.organization import RegisterOrganizationSchema, OrganizationUpdateSchema
from app.core.enums import OrgMemberRole
from app.db.supabase import get_supabase_client
import uuid


class OrgService:

    @staticmethod
    def get_admin_org_id(current_user: SupabaseUser, db: Session) -> uuid.UUID:
        """Resolve the org_id for the currently authenticated user. Used by all services."""
        member = db.query(OrgMember).filter(OrgMember.id == current_user.id).first()
        if not member:
            raise HTTPException(status_code=404, detail="Member record not found")
        return member.org_id

    # ─────────────────────────────────────────
    # 1. Register a new organization + owner
    # Called from POST /api/organization (public)
    # Uses Supabase client — no db needed
    # ─────────────────────────────────────────
    @staticmethod
    async def register_organization(payload: RegisterOrganizationSchema):
        supabase = get_supabase_client()
        try:
            # 1. Create the owner user in Supabase Auth
            auth_response = supabase.auth.admin.create_user({
                "email": payload.email,
                "password": payload.password,
                "email_confirm": True,
                "user_metadata": {
                    "first_name": payload.first_name,
                    "last_name": payload.last_name,
                    "role": OrgMemberRole.owner
                }
            })

            user = auth_response.user

            # 2. Create the organization record
            org_response = supabase.table("organizations").insert({
                "id": str(uuid.uuid4()),
                "name": payload.organization_name,
                "owner_id": user.id
            }).execute()

            organization = org_response.data[0]

            # 3. Link the owner to the organization
            supabase.table("org_members").insert({
                "id": user.id,
                "first_name": payload.first_name,
                "last_name": payload.last_name,
                "email": payload.email,
                "role": OrgMemberRole.owner,
                "org_id": organization["id"]
            }).execute()

            return {
                "message": "Organization registered successfully",
                "org_id": organization["id"],
                "user_id": user.id
            }

        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))

    # ─────────────────────────────────────────
    # 2. Get the current user's organization
    # ─────────────────────────────────────────
    @staticmethod
    async def get_organization(current_user: SupabaseUser, db: Session):
        try:
            org_id = OrgService.get_admin_org_id(current_user, db)
            org = db.query(Organization).filter(Organization.id == org_id).first()
            if not org:
                raise HTTPException(status_code=404, detail="Organization not found")
            return org

        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))

    # ─────────────────────────────────────────
    # 3. Update organization (owner only)
    # ─────────────────────────────────────────
    @staticmethod
    async def update_organization(payload: OrganizationUpdateSchema, current_user: SupabaseUser, db: Session):
        try:
            org_id = OrgService.get_admin_org_id(current_user, db)
            org = db.query(Organization).filter(Organization.id == org_id).first()
            if not org:
                raise HTTPException(status_code=404, detail="Organization not found")

            updates = payload.model_dump(exclude_unset=True)
            for field, value in updates.items():
                setattr(org, field, value)

            db.commit()
            db.refresh(org)
            return org

        except HTTPException:
            raise
        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=400, detail=str(e))

    # ─────────────────────────────────────────
    # 4. Deactivate organization (owner only)
    # Sets is_active = False — does not hard delete
    # ─────────────────────────────────────────
    @staticmethod
    async def delete_organization(current_user: SupabaseUser, db: Session):
        try:
            org_id = OrgService.get_admin_org_id(current_user, db)
            org = db.query(Organization).filter(Organization.id == org_id).first()
            if not org:
                raise HTTPException(status_code=404, detail="Organization not found")

            org.is_active = False
            db.commit()
            return {"message": "Organization deactivated successfully"}

        except HTTPException:
            raise
        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=400, detail=str(e))
