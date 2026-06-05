from datetime import date
from sqlalchemy import extract
from sqlalchemy.orm import Session
from app.models.progress_note import ProgressNote
from app.models.shift import Shift
from app.models.employment import Employment
from app.models.client import Client
from app.core.exceptions import AppError


class ProgressNoteRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_shift(self, shift_id, org_id) -> Shift:
        """Fetch a non-deleted shift by primary key scoped to an organisation.

        Raises AppError with 404 if no matching active record exists —
        never returns None.

        Args:
            shift_id: Primary key of the shift to fetch.
            org_id: Organisation the shift must belong to (tenant isolation).

        Returns:
            The matching Shift ORM instance.

        Raises:
            AppError: If no active shift matches shift_id and org_id.
        """
        shift = self.db.query(Shift).filter(
            Shift.id == shift_id,
            Shift.org_id == org_id,
            Shift.deleted_at == None,  # noqa: E711
        ).first()
        if not shift:
            raise AppError(status_code=404, code="NOT_FOUND", message="Shift not found")
        return shift

    def get_client(self, client_id, org_id) -> Client:
        """Fetch a non-deleted client by primary key scoped to an organisation.

        Raises AppError with 404 if no matching active record exists —
        never returns None.

        Args:
            client_id: Primary key of the client to fetch.
            org_id: Organisation the client must belong to (tenant isolation).

        Returns:
            The matching Client ORM instance.

        Raises:
            AppError: If no active client matches client_id and org_id.
        """
        client = self.db.query(Client).filter(
            Client.id == client_id,
            Client.org_id == org_id,
            Client.deleted_at == None,  # noqa: E711
        ).first()
        if not client:
            raise AppError(404, "CLIENT_NOT_FOUND", "Client not found")
        return client

    def get_by_shift_and_date(self, shift_id, occurrence_date: date) -> ProgressNote | None:
        """Fetch a progress note for a specific shift occurrence date.

        Returns None if no note has been created for this occurrence yet —
        does not raise.

        Args:
            shift_id: Primary key of the shift the note belongs to.
            occurrence_date: The specific occurrence date of the shift.

        Returns:
            The matching ProgressNote ORM instance, or None if not found.
        """
        return self.db.query(ProgressNote).filter(
            ProgressNote.shift_id == shift_id,
            ProgressNote.occurrence_date == occurrence_date,
        ).first()

    def get_client_notes_joined(
        self,
        client_id,
        org_id,
        year: int | None = None,
    ) -> list[tuple[ProgressNote, Employment]]:
        query = (
            self.db.query(ProgressNote, Employment)
            .join(Shift, ProgressNote.shift_id == Shift.id)
            .join(Employment, Shift.worker_id == Employment.id)
            .filter(
                Shift.client_id == client_id,
                Shift.org_id == org_id,
            )
        )
        if year:
            query = query.filter(extract("year", ProgressNote.occurrence_date) == year)
        return query.order_by(ProgressNote.occurrence_date.desc()).all()

    def add(self, note: ProgressNote) -> None:
        """Stage a new ProgressNote for insertion.

        Does not commit — the caller is responsible for calling db.commit().

        Args:
            note: The ProgressNote ORM instance to stage.
        """
        self.db.add(note)
