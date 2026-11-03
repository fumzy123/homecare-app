# Leave and occurrence replacement

Recording leave now previews effective visit intervals overlapping inclusive agency-local leave dates. Confirmation checks the reviewed visit identities and times again under the agency lock. Future scheduled, undocumented occurrences become dropped in the same transaction as the leave record and worker notifications. Moved and overnight visits use effective intervals; elapsed, ongoing, completed and documented visits are retained.

Dropped visits appear yellow and produce existing Action Tower replacement cases, including future dates outside its normal window. The original worker remains historical provenance, not the expected attendee. The calendar labels the gap “Needs replacement.”

The visit drawer's Arrange cover action creates one non-recurring replacement with the original client, effective times and instructions. Active agency membership, recorded availability, leave, conflicts and hours are checked. The original occurrence becomes cancelled with a replacement link, retaining the leave reason and original worker. It remains visible as cancelled history; only the replacement is scheduled. Organization locking and status rechecks prevent duplicate replacement. Recurring assignments are unchanged. The replacement retains the weekly care revision/slot links.

Deleting leave never silently restores dropped occurrences or undoes replacement coverage. The removal confirmation directs staff to review unresolved visits. Existing leave records are not backfilled: delete and recreate a test leave to exercise the new flow.

Apply Alembic `ab731eed0142` after `6783506efc77` before the updated API. It adds two nullable columns and a replacement foreign key to existing modifications. Existing RLS is unchanged. Production rollout is separate.

Tests: `tests/services/test_leave_service.py` (SQLite, or isolated PostgreSQL via `LEAVE_TEST_DATABASE_URL` ending in `_test`), `tests/integration/test_leave_migration.py`, frontend `tests/leave-coverage.test.jsx` and existing scheduling regression suites. CI runs both PostgreSQL transaction and migration checks before Railway deployment.
