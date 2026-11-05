# Leave and occurrence replacement

Recording leave now previews effective visit intervals overlapping inclusive agency-local leave dates. Confirmation checks the reviewed visit identities and times again under the agency lock. Future scheduled, undocumented occurrences become dropped in the same transaction as the leave record and worker notifications. Moved and overnight visits use effective intervals; elapsed, ongoing, completed and documented visits are retained.

Dropped visits appear yellow and produce existing Action Tower replacement cases, including future dates outside its normal window. The original worker remains historical provenance, not the expected attendee. The calendar labels the gap “Needs replacement.”

The visit drawer's Edit action creates one non-recurring replacement with the original client, effective times and instructions. Active agency membership, recorded availability, leave, conflicts and hours are checked. The original occurrence becomes cancelled with a replacement link, retaining the leave reason and original worker. It remains in attendance history, but is hidden from both calendar views; only the replacement is scheduled. The replacement card shows Replacement cover and expandable original-worker history. Organization locking and status rechecks prevent duplicate replacement. Recurring assignments are unchanged. The replacement retains the weekly care revision/slot links.

Deleting leave never silently restores dropped occurrences or undoes replacement coverage. The removal confirmation directs staff to review unresolved visits. Existing leave records are not backfilled: delete and recreate a test leave to exercise the new flow.

Apply Alembic `ab731eed0142` after `6783506efc77` before the updated API. It adds two nullable columns and a replacement foreign key to existing modifications. Existing RLS is unchanged. Production rollout is separate.

Tests: `tests/services/test_leave_service.py` (SQLite, or isolated PostgreSQL via `LEAVE_TEST_DATABASE_URL` ending in `_test`), `tests/integration/test_leave_migration.py`, frontend `tests/leave-coverage.test.jsx` and existing scheduling regression suites. CI runs both PostgreSQL transaction and migration checks before Railway deployment.


## Attendance provenance (2026-11-05)

The read API batch-resolves replacement origins within the agency, including when
filtered to the replacement worker. Existing persisted original occurrence links and
leave reasons supply the history without a new counter table or migration. Resolving
a gap no longer removes it from the original worker's dropped/unable-to-attend count.
Monthly/yearly attendance separates recorded leave, other drops (initiator unspecified),
no-shows, cover assigned and cover completed. Assigned cover includes subsequently
cancelled/dropped cover; completion is counted separately. Periods use effective visit
start dates, and duplicate occurrences count once. These are descriptive counts, not
a reliability score. Existing records do not prove worker-initiated drops and must not
be labeled as such. Leave removal does not delete occurrence provenance.


Replacement editing checks agency-scoped leave against the effective occurrence via
GET /shifts/{id}/occurrences/{date}/replacement-availability. All overlapping workers
remain visible as disabled “On leave” options. Loading/failure blocks selection and
saving; failure offers an explicit retry. One repository query retrieves candidate
leave records and the shared domain interval rule handles moved/overnight visits,
midnight boundaries and cross-year leave. The save transaction still rechecks leave.
No migration is required.
