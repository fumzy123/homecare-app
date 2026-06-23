from sqlalchemy.orm import Session, joinedload
from app.models.client import Client
from app.models.employment import Employment
from app.core.enums import ClientStatus
from app.core.exceptions import AppError


class ClientRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_active_client(self, client_id, org_id) -> Client:
        """Fetch a non-deleted client by primary key scoped to an organisation.

        Eagerly loads the assigned_worker relationship in a single query.
        Raises AppError with 404 if no matching active record exists —
        never returns None.

        Args:
            client_id: Primary key of the client to fetch.
            org_id: Organisation the client must belong to (tenant isolation).

        Returns:
            The matching Client ORM instance with assigned_worker populated.

        Raises:
            AppError: If no active client matches client_id and org_id.
        """
        client = (
            self.db.query(Client)
            .options(joinedload(Client.assigned_worker).joinedload(Employment.person))
            .filter(
                Client.id == client_id,
                Client.org_id == org_id,
                Client.deleted_at == None,  # noqa: E711
            )
            .first()
        )
        if not client:
            raise AppError(status_code=404, code="NOT_FOUND", message="Client not found")
        return client

    def get_with_worker_by_id(self, client_id) -> Client | None:
        """Fetch a client by primary key, eagerly loading assigned_worker.

        Used after insert or update to return the fully populated record.
        Does not filter on org_id or deleted_at — use only when the caller
        already holds a valid client instance from a prior scoped query.

        Args:
            client_id: Primary key of the client to fetch.

        Returns:
            The matching Client ORM instance with assigned_worker populated,
            or None if no record exists.
        """
        return (
            self.db.query(Client)
            .options(joinedload(Client.assigned_worker).joinedload(Employment.person))
            .filter(Client.id == client_id)
            .first()
        )

    def get_all(self, org_id, status: ClientStatus | None = None) -> list[Client]:
        """Fetch all non-deleted clients for an organisation.

        Eagerly loads the assigned_worker relationship. Optionally filters
        by client status. Results are unordered.

        Args:
            org_id: Organisation scope (tenant isolation).
            status: If provided, only clients with this status are returned.

        Returns:
            List of Client ORM instances with assigned_worker populated.
            Returns an empty list if no clients exist.
        """
        query = (
            self.db.query(Client)
            .options(joinedload(Client.assigned_worker).joinedload(Employment.person))
            .filter(
                Client.org_id == org_id,
                Client.deleted_at == None,  # noqa: E711
            )
        )
        if status is not None:
            query = query.filter(Client.status == status)
        return query.all()

    def add(self, client: Client) -> None:
        """Stage a new Client for insertion.

        Does not commit — the caller is responsible for calling db.commit().

        Args:
            client: The Client ORM instance to stage.
        """
        self.db.add(client)
