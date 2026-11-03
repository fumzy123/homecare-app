"""Exercise additive leave migration against the previous PostgreSQL shape."""
import importlib.util
import os
from pathlib import Path

import pytest
from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import make_url


def test_leave_migration_preserves_existing_schema_and_adds_nullable_history(monkeypatch):
    url = os.getenv('CARE_TEST_DATABASE_URL')
    if not url:
        pytest.skip('Requires isolated PostgreSQL')
    assert make_url(url).database.endswith('_test')
    engine = create_engine(url)
    path = Path(__file__).parents[2] / 'alembic/versions/ab731eed0142_leave_visit_coverage.py'
    spec = importlib.util.spec_from_file_location('leave_migration', path)
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    with engine.connect() as connection:
        transaction = connection.begin()
        try:
            connection.execute(text('ALTER TABLE shift_modifications DROP COLUMN replacement_shift_id, DROP COLUMN dropped_reason'))
            monkeypatch.setattr(migration, 'op', Operations(MigrationContext.configure(connection)))
            migration.upgrade()
            columns = {c['name']: c for c in inspect(connection).get_columns('shift_modifications')}
            assert columns['replacement_shift_id']['nullable']
            assert columns['dropped_reason']['nullable']
            assert 'notes' in columns and 'original_date' in columns
            assert any(f['name'] == 'fk_modification_replacement' for f in inspect(connection).get_foreign_keys('shift_modifications'))
        finally:
            transaction.rollback()
    engine.dispose()
