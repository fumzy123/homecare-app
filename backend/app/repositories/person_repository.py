from sqlalchemy.orm import Session
from app.models.person import Person
from app.core.exceptions import AppError


class PersonRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_supabase_user_id(self, supabase_user_id) -> Person | None:
        return self.db.query(Person).filter(
            Person.supabase_user_id == supabase_user_id
        ).first()

    def get_by_id(self, person_id) -> Person | None:
        return self.db.query(Person).filter(Person.id == person_id).first()

    def get_by_email(self, email: str) -> Person | None:
        return self.db.query(Person).filter(Person.email == email).first()

    def add(self, person: Person) -> None:
        self.db.add(person)
