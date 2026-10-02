"""Test-wide environment defaults required while importing the application."""

import os


os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_SECRET_KEY", "test-secret-key")
os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+psycopg2://test:test@localhost:5432/homecare_test",
)


# Isolated SQLite service fixtures use JSON storage for PostgreSQL JSONB columns.
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles


@compiles(JSONB, "sqlite")
def compile_jsonb_for_sqlite(_element, _compiler, **_kw):
    return "JSON"
