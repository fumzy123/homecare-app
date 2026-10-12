from uuid import UUID
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.security import require_admin
from app.core.exceptions import AppError
from app.repositories.organization_repository import OrganizationRepository
from app.schemas.assignment import EndAssignments
from app.services.assignment_service import AssignmentService

router = APIRouter(prefix='/assignments', tags=['Assignments'])


def get_assignment_service(db: Session = Depends(get_db), current_user=Depends(require_admin)):
    member = OrganizationRepository(db).get_active_employment_for_user(current_user.id)
    if not member:
        raise AppError(404, 'NOT_FOUND', 'Member record not found')
    return AssignmentService(db, current_user, member.org_id)


@router.get('')
def list_assignments(worker_id: UUID | None = None, client_id: UUID | None = None,
                     assignment_service: AssignmentService = Depends(get_assignment_service)):
    return assignment_service.list_assignments(worker_id, client_id)


@router.post('/end-review')
def review_end(payload: EndAssignments, assignment_service: AssignmentService = Depends(get_assignment_service)):
    return assignment_service.review_end(payload)


@router.post('/end')
def end_assignments(payload: EndAssignments, assignment_service: AssignmentService = Depends(get_assignment_service)):
    return assignment_service.end_assignments(payload)
