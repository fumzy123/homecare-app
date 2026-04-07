from sqlalchemy.orm import DeclarativeBase

# This is the master blueprint that all our models will inherit from
class Base(DeclarativeBase):
    pass
