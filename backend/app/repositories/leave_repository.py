from sqlalchemy.orm import Session
from sqlalchemy import extract
from app.models.leave_record import LeaveRecord
from app.models.org_member import OrgMember
from app.core.exceptions import AppError


class LeaveRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_worker(self, worker_id: str, org_id) -> OrgMember:
        """Fetch an active org member scoped to an organisation.

        Filters out soft-deleted members via deleted_at IS NULL. Raises
        AppError with 404 if no matching active member exists — never
        returns None.

        Args:
            worker_id: Primary key of the org member to fetch.
            org_id: Organisation the member must belong to (tenant isolation).

        Returns:
            The matching OrgMember ORM instance.

        Raises:
            AppError: If no active member matches worker_id and org_id.
        """
        worker = (
            self.db.query(OrgMember)
            .filter(
                OrgMember.id == worker_id,
                OrgMember.org_id == org_id,
                OrgMember.deleted_at.is_(None),
            )
            .first()
        )
        if not worker:
            raise AppError(404, "WORKER_NOT_FOUND", "Worker not found")
        return worker

    def list_by_worker_and_year(self, worker_id: str, org_id, year: int) -> list[LeaveRecord]:
        """Fetch all leave records for a worker in a given calendar year.

        Filters by worker, organisation, and year extracted from start_date.
        Results are ordered by start_date descending (most recent first).

        Args:
            worker_id: Primary key of the worker whose records to fetch.
            org_id: Organisation scope (tenant isolation).
            year: Calendar year to filter on, matched against start_date.

        Returns:
            List of LeaveRecord instances ordered by start_date descending.
            Returns an empty list if no records exist.
        """
        return (
            self.db.query(LeaveRecord)
            .filter(
                LeaveRecord.worker_id == worker_id,
                LeaveRecord.org_id == org_id,
                extract("year", LeaveRecord.start_date) == year,
            )
            .order_by(LeaveRecord.start_date.desc())
            .all()
        )

    def get_by_id_worker_org(self, leave_id: str, worker_id: str, org_id) -> LeaveRecord:
        """Fetch a single leave record by primary key scoped to a worker and organisation.

        Raises AppError with 404 if no matching record exists — never
        returns None.

        Args:
            leave_id: Primary key of the leave record to fetch.
            worker_id: Worker the record must belong to.
            org_id: Organisation scope (tenant isolation).

        Returns:
            The matching LeaveRecord ORM instance.

        Raises:
            AppError: If no record matches leave_id, worker_id, and org_id.
        """
        record = (
            self.db.query(LeaveRecord)
            .filter(
                LeaveRecord.id == leave_id,
                LeaveRecord.worker_id == worker_id,
                LeaveRecord.org_id == org_id,
            )
            .first()
        )
        if not record:
            raise AppError(404, "LEAVE_RECORD_NOT_FOUND", "Leave record not found")
        return record

    def add(self, record: LeaveRecord) -> None:
        """Stage a new LeaveRecord for insertion.

        Does not commit — the caller is responsible for calling db.commit().

        Args:
            record: The LeaveRecord ORM instance to stage.
        """
        self.db.add(record)

    def delete(self, record: LeaveRecord) -> None:
        """Stage a LeaveRecord for hard deletion.

        Does not commit — the caller is responsible for calling db.commit().
        This is a hard delete; no soft-delete column exists on LeaveRecord.

        Args:
            record: The LeaveRecord ORM instance to delete.
        """
        self.db.delete(record)
