from datetime import date, datetime
from uuid import uuid4

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.core.exceptions import AppError
from app.models.client import Client
from app.models.shift import Shift
from app.repositories.worker_client_repository import WorkerClientRepository


def test_clients_are_scoped_to_worker_and_tenant_including_retained_history():
    engine = create_engine('sqlite://')
    Client.__table__.create(engine)
    Shift.__table__.create(engine)
    org, worker, other = uuid4(), uuid4(), uuid4()
    with Session(engine) as db:
        def client(**changes):
            value = Client(**(dict(
                first_name='Sample', last_name='Client', date_of_birth=date(1940, 1, 1),
                street='1 Example Street', city='Example', province='NL', postal_code='A1A1A1',
                emergency_contact_name='Contact', emergency_contact_phone='555',
                emergency_contact_relationship='Family', org_id=org,
            ) | changes))
            db.add(value)
            db.flush()
            return value

        def shift(person, **changes):
            db.add(Shift(**(dict(
                org_id=org, worker_id=worker, created_by=worker, client_id=person.id,
                start_time=datetime(2020, 1, 1, 9), end_time=datetime(2020, 1, 1, 10),
            ) | changes)))

        assigned = client(assigned_worker_id=worker)
        historical = client(assigned_worker_id=other)
        shift(historical)
        shift(historical)  # Multiple visits still produce one client.
        unrelated = client(assigned_worker_id=other)
        shift(unrelated, worker_id=other)
        foreign = client(org_id=uuid4(), assigned_worker_id=worker)
        shift(foreign)
        removed = client(deleted_at=datetime.now(), assigned_worker_id=worker)
        shift(removed)
        deleted_visit = client()
        shift(deleted_visit, deleted_at=datetime.now())
        foreign_visit = client()
        shift(foreign_visit, org_id=uuid4())
        db.commit()

        repo = WorkerClientRepository(db)
        assert {c.id for c in repo.list_for_worker(org, worker)} == {assigned.id, historical.id}
        assert repo.get_for_worker(historical.id, org, worker).id == historical.id
        for hidden in [unrelated, foreign, removed, deleted_visit, foreign_visit]:
            with pytest.raises(AppError) as error:
                repo.get_for_worker(hidden.id, org, worker)
            assert error.value.status_code == 404
    engine.dispose()
