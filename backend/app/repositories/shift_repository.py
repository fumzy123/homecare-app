from datetime import date, datetime, time, timezone
from sqlalchemy.orm import Session, joinedload
from app.models.shift import Shift
from app.models.shift_modification import ShiftModification
from app.models.employment import Employment
from app.models.client import Client
from app.core.enums import ShiftStatus
from app.core.exceptions import AppError


class ShiftRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_active_shift(self, shift_id, org_id) -> Shift:
        """Fetch a non-deleted shift by primary key scoped to an organisation.

        Eagerly loads worker, client, and modifications relationships in a
        single query using joinedload. Raises AppError with 404 if no
        matching active record exists — never returns None.

        Args:
            shift_id: Primary key of the shift to fetch.
            org_id: Organisation the shift must belong to (tenant isolation).

        Returns:
            The matching Shift ORM instance with worker, client, and
            modifications relationships populated.

        Raises:
            AppError: If no active shift matches shift_id and org_id.
        """
        shift = (
            self.db.query(Shift)
            .options(
                joinedload(Shift.worker),
                joinedload(Shift.client),
                joinedload(Shift.modifications),
            )
            .filter(
                Shift.id == shift_id,
                Shift.org_id == org_id,
                Shift.deleted_at == None,  # noqa: E711
            )
            .first()
        )
        if not shift:
            raise AppError(status_code=404, code="NOT_FOUND", message="Shift not found")
        return shift

    def get_active_shifts_for_conflict_check(self, worker_id, org_id) -> list[Shift]:
        """Fetch all active, non-deleted shifts assigned to a worker in an organisation.

        Eagerly loads modifications and client relationships used during
        conflict detection. Returns all shifts regardless of date range —
        the caller is responsible for scoping by date.

        Args:
            worker_id: Worker whose shifts to fetch.
            org_id: Organisation scope (tenant isolation).

        Returns:
            List of Shift ORM instances with modifications and client
            relationships populated. Returns an empty list if none exist.
        """
        return (
            self.db.query(Shift)
            .options(joinedload(Shift.modifications), joinedload(Shift.client))
            .filter(
                Shift.worker_id == worker_id,
                Shift.org_id == org_id,
                Shift.status == ShiftStatus.active,
                Shift.deleted_at == None,  # noqa: E711
            )
            .all()
        )

    def get_shifts_in_range(
        self,
        org_id,
        to_date: date,
        worker_id=None,
        client_id=None,
    ) -> list[Shift]:
        """Fetch all active, non-deleted shifts that start on or before to_date.

        Eagerly loads worker, client, and modifications relationships.
        Used for calendar and stats queries where all occurrences in a
        date range must be expanded in Python. Optionally scoped by worker
        or client.

        Args:
            org_id: Organisation scope (tenant isolation).
            to_date: Upper date bound — only shifts with start_time on or
                before midnight of this date are returned.
            worker_id: If provided, only shifts assigned to this worker.
            client_id: If provided, only shifts for this client.

        Returns:
            List of Shift ORM instances with worker, client, and
            modifications populated. Returns an empty list if none exist.
        """
        query = (
            self.db.query(Shift)
            .options(
                joinedload(Shift.worker).joinedload(Employment.person),
                joinedload(Shift.client),
                joinedload(Shift.modifications),
            )
            .filter(
                Shift.org_id == org_id,
                Shift.status == ShiftStatus.active,
                Shift.deleted_at == None,  # noqa: E711
                Shift.start_time <= datetime.combine(to_date, time.max, tzinfo=timezone.utc),
            )
        )
        if worker_id:
            query = query.filter(Shift.worker_id == worker_id)
        if client_id:
            query = query.filter(Shift.client_id == client_id)
        return query.all()

    def get_client_by_id(self, client_id) -> Client | None:
        """Fetch a client by primary key with no additional filters.

        Used to look up the client's address for shift location fallback.
        Returns None if no record exists.

        Args:
            client_id: Primary key of the client to fetch.

        Returns:
            The matching Client ORM instance, or None if not found.
        """
        return self.db.query(Client).filter(Client.id == client_id).first()

    def get_active_shifts_for_client(self, client_id, org_id) -> list[Shift]:
        """Fetch all active, non-deleted shifts assigned to a client in an organisation.

        Used during client deletion to find shifts that need to be truncated
        or cancelled. Does not load relationships — caller only needs scalar fields.

        Args:
            client_id: Client whose shifts to fetch.
            org_id: Organisation scope (tenant isolation).

        Returns:
            List of Shift ORM instances. Returns an empty list if none exist.
        """
        return (
            self.db.query(Shift)
            .filter(
                Shift.client_id == client_id,
                Shift.org_id == org_id,
                Shift.status == ShiftStatus.active,
                Shift.deleted_at == None,  # noqa: E711
            )
            .all()
        )

    def add(self, shift: Shift) -> None:
        """Stage a new Shift for insertion.

        Does not commit — the caller is responsible for calling db.commit().

        Args:
            shift: The Shift ORM instance to stage.
        """
        self.db.add(shift)

    def delete_modifications_from_date(self, shift_id, from_date: date) -> None:
        """Hard-delete all ShiftModification records for a shift on or after a given date.

        Used when truncating or splitting a recurring series — removes
        forward modifications so they don't orphan after the series is
        shortened. Does not commit — the caller owns the transaction.

        Args:
            shift_id: The shift whose modifications to delete.
            from_date: Modifications with original_date >= this date are deleted.
        """
        self.db.query(ShiftModification).filter(
            ShiftModification.shift_id == shift_id,
            ShiftModification.original_date >= from_date,
        ).delete(synchronize_session=False)


class ShiftModificationRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_shift_and_date(self, shift_id, original_date: date) -> ShiftModification | None:
        """Fetch a shift modification for a specific occurrence date.

        Returns None if no modification exists for this occurrence —
        does not raise.

        Args:
            shift_id: The shift the modification belongs to.
            original_date: The occurrence date the modification targets.

        Returns:
            The matching ShiftModification ORM instance, or None if not found.
        """
        return (
            self.db.query(ShiftModification)
            .filter(
                ShiftModification.shift_id == shift_id,
                ShiftModification.original_date == original_date,
            )
            .first()
        )

    def get_modification_by_shift_and_date_required(self, shift_id, original_date: date) -> ShiftModification:
        """Fetch a shift modification for a specific occurrence date.

        Raises AppError with 404 if no matching record exists — never
        returns None.

        Args:
            shift_id: The shift the modification belongs to.
            original_date: The occurrence date the modification targets.

        Returns:
            The matching ShiftModification ORM instance.

        Raises:
            AppError: If no modification matches shift_id and original_date.
        """
        mod = self.get_by_shift_and_date(shift_id, original_date)
        if not mod:
            raise AppError(status_code=404, code="NOT_FOUND", message="Modification not found")
        return mod

    def add(self, mod: ShiftModification) -> None:
        """Stage a new ShiftModification for insertion.

        Does not commit — the caller is responsible for calling db.commit().

        Args:
            mod: The ShiftModification ORM instance to stage.
        """
        self.db.add(mod)
