from sqlalchemy.orm import Session, joinedload
from supabase_auth.types import User as SupabaseUser
from app.models.org_member import OrgMember
from app.models.worker_profile import WorkerProfile
from app.schemas.worker import OrgMemberUpdateSchema, WorkerProfileCreateSchema, WorkerProfileUpdateSchema
from app.core.enums import OrgMemberRole
from app.core.exceptions import AppError
from app.services.org_service import OrgService


class WorkerService:

    @staticmethod
    def _get_active_worker(worker_id: str, org_id, db: Session) -> OrgMember:
        """Fetch a non-deleted worker that belongs to the admin's org."""
        worker = (
            db.query(OrgMember)
            .options(joinedload(OrgMember.worker_profile))
            .filter(
                OrgMember.id == worker_id,
                OrgMember.org_id == org_id,
                OrgMember.role == OrgMemberRole.home_support_worker,
                OrgMember.deleted_at == None,  # noqa: E711
            )
            .first()
        )
        if not worker:
            raise AppError(status_code=404, code="NOT_FOUND", message="Worker not found")
        return worker

    # ─────────────────────────────────────────
    # 1. List all workers in the admin's org
    # ─────────────────────────────────────────
    @staticmethod
    async def get_all_workers(current_user: SupabaseUser, db: Session):
        try:
            org_id = OrgService.get_admin_org_id(current_user, db)

            return (
                db.query(OrgMember)
                .options(joinedload(OrgMember.worker_profile))
                .filter(
                    OrgMember.org_id == org_id,
                    OrgMember.role == OrgMemberRole.home_support_worker,
                    OrgMember.deleted_at == None,  # noqa: E711
                )
                .all()
            )

        except AppError:
            raise
        except Exception as e:
            raise AppError(status_code=400, code="BAD_REQUEST", message=str(e))

    # ─────────────────────────────────────────
    # 2. Get a single worker's full profile
    # ─────────────────────────────────────────
    @staticmethod
    async def get_worker(worker_id: str, current_user: SupabaseUser, db: Session):
        try:
            org_id = OrgService.get_admin_org_id(current_user, db)
            return WorkerService._get_active_worker(worker_id, org_id, db)

        except AppError:
            raise
        except Exception as e:
            raise AppError(status_code=400, code="BAD_REQUEST", message=str(e))

    # ─────────────────────────────────────────
    # 3. Create or update worker profile (upsert)
    # ─────────────────────────────────────────
    @staticmethod
    async def create_worker_profile(worker_id: str, payload: WorkerProfileCreateSchema, current_user: SupabaseUser, db: Session):
        try:
            org_id = OrgService.get_admin_org_id(current_user, db)

            worker = (
                db.query(OrgMember)
                .filter(
                    OrgMember.id == worker_id,
                    OrgMember.org_id == org_id,
                    OrgMember.role == OrgMemberRole.home_support_worker,
                    OrgMember.deleted_at == None,  # noqa: E711
                )
                .first()
            )
            if not worker:
                raise AppError(status_code=404, code="NOT_FOUND", message="Worker not found")

            profile = db.query(WorkerProfile).filter(WorkerProfile.org_member_id == worker_id).first()

            if profile:
                updates = payload.model_dump(exclude_unset=True)
                for field, value in updates.items():
                    setattr(profile, field, value)
            else:
                profile = WorkerProfile(org_member_id=worker_id, **payload.model_dump())
                db.add(profile)

            db.commit()

            return (
                db.query(OrgMember)
                .options(joinedload(OrgMember.worker_profile))
                .filter(OrgMember.id == worker_id)
                .first()
            )

        except AppError:
            raise
        except Exception as e:
            db.rollback()
            raise AppError(status_code=400, code="BAD_REQUEST", message=str(e))

    # ─────────────────────────────────────────
    # 4. Update worker — org_member fields
    # ─────────────────────────────────────────
    @staticmethod
    async def update_worker(worker_id: str, payload: OrgMemberUpdateSchema, current_user: SupabaseUser, db: Session):
        try:
            org_id = OrgService.get_admin_org_id(current_user, db)
            worker = WorkerService._get_active_worker(worker_id, org_id, db)

            updates = payload.model_dump(exclude_unset=True)
            for field, value in updates.items():
                setattr(worker, field, value)

            db.commit()

            return (
                db.query(OrgMember)
                .options(joinedload(OrgMember.worker_profile))
                .filter(OrgMember.id == worker_id)
                .first()
            )

        except AppError:
            raise
        except Exception as e:
            db.rollback()
            raise AppError(status_code=400, code="BAD_REQUEST", message=str(e))

    # ─────────────────────────────────────────
    # 5. Update worker profile — worker_profiles fields
    # ─────────────────────────────────────────
    @staticmethod
    async def update_worker_profile(worker_id: str, payload: WorkerProfileUpdateSchema, current_user: SupabaseUser, db: Session):
        try:
            org_id = OrgService.get_admin_org_id(current_user, db)
            WorkerService._get_active_worker(worker_id, org_id, db)

            profile = db.query(WorkerProfile).filter(WorkerProfile.org_member_id == worker_id).first()
            if not profile:
                raise AppError(status_code=404, code="NOT_FOUND", message="Worker profile not found")

            updates = payload.model_dump(exclude_unset=True)
            for field, value in updates.items():
                setattr(profile, field, value)

            db.commit()

            return (
                db.query(OrgMember)
                .options(joinedload(OrgMember.worker_profile))
                .filter(OrgMember.id == worker_id)
                .first()
            )

        except AppError:
            raise
        except Exception as e:
            db.rollback()
            raise AppError(status_code=400, code="BAD_REQUEST", message=str(e))

    # ─────────────────────────────────────────
    # 6. Soft delete a worker
    # ─────────────────────────────────────────
    @staticmethod
    async def delete_worker(worker_id: str, current_user: SupabaseUser, db: Session):
        from datetime import datetime, timezone
        try:
            org_id = OrgService.get_admin_org_id(current_user, db)
            worker = WorkerService._get_active_worker(worker_id, org_id, db)

            worker.deleted_at = datetime.now(timezone.utc)
            db.commit()

            return {"message": "Worker deleted successfully"}

        except AppError:
            raise
        except Exception as e:
            db.rollback()
            raise AppError(status_code=400, code="BAD_REQUEST", message=str(e))
