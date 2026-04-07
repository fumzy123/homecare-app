from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

# Direct connection to Supabase Postgres
engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,   # checks connection is alive before using it
    pool_size=10,         # max 10 persistent connections
    max_overflow=20       # 20 extra connections allowed under heavy load
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Dependency injected into your routes
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()