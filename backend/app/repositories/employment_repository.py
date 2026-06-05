from sqlalchemy.orm import Session
from app.models.employment import Employment
from app.core.enums import OrgMemberRole, ADMIN_ROLES, OVERTIME_APPROVERS
from app.core.exceptions import AppError


class EmploymentRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_active_by_person_id(self, person_id) -> Employment | None:
        return self.db.query(Employment).filter(
            Employment.person_id == person_id,
            Employment.deleted_at.is_(None),
        ).first()

    def get_by_id(self, employment_id) -> Employment | None:
        return self.db.query(Employment).filter(Employment.id == employment_id).first()

    def get_active_by_id_and_org(self, employment_id, org_id) -> Employment:
        employment = self.db.query(Employment).filter(
            Employment.id == employment_id,
            Employment.org_id == org_id,
            Employment.deleted_at.is_(None),
        ).first()
        if not employment:
            raise AppError(status_code=404, code="NOT_FOUND", message="Member not found")
        return employment

    def get_all_active_by_org(self, org_id, role: OrgMemberRole | None = None) -> list[Employment]:
        query = self.db.query(Employment).filter(
            Employment.org_id == org_id,
            Employment.deleted_at.is_(None),
        )
        if role is not None:
            query = query.filter(Employment.role == role)
        return query.all()

    def get_active_admin_ids_for_org(self, org_id) -> list:
        rows = self.db.query(Employment.id).filter(
            Employment.org_id == org_id,
            Employment.role.in_(ADMIN_ROLES),
            Employment.deleted_at.is_(None),
        ).all()
        return [r.id for r in rows]

    def get_active_approver_ids_for_org(self, org_id) -> list:
        rows = self.db.query(Employment.id).filter(
            Employment.org_id == org_id,
            Employment.role.in_(OVERTIME_APPROVERS),
            Employment.deleted_at.is_(None),
        ).all()
        return [r.id for r in rows]

    def add(self, employment: Employment) -> None:
        self.db.add(employment)
