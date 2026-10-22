# Direct Care Slot assignment

Implemented and tested locally October 16, 2026. Hosted databases and deployments were not changed.

## Admin workflow

Open **Client → Weekly care need → Review coverage**, or an open **Care request**. Select a worker for one or several uncovered slots, and choose **Review approval**. Each dropdown groups **Interested in this slot** first, followed by **Other active workers**. The separate search and interest toggle were removed October 20; selections persist between the coverage and interested-worker tabs. Workers do not need to express interest first.

The review shows the selected workers, availability, conflicts, hours checks, hours for the first affected week, previous coverage that ends and uncovered slots. For workers without interest, confirm **I have arranged this coverage with the directly selected workers**. Acknowledge any gaps, then **Approve and schedule**. Coverage refreshes in the same workspace. Existing worker-interest selection remains available.

This requires an existing open request linked to a saved care revision. Posting requirements and the legacy whole-request endpoint are unchanged. Recorded availability and scheduling limits still apply to phone arrangements.

## API and history

The existing `/api/placements/{id}/approval-review` and `/approve` routes accept `assignment_source` on each selection: `worker_interest` (default, retaining the interest check) or `admin_arranged`. Approval with any direct selections additionally requires `confirm_admin_arranged: true`. The reviewed-state token includes each selection's source.

No interest is fabricated. `CareSlotAssignment.assignment_source` retains provenance alongside existing `approved_by` and `approved_at`. Coverage and assignment-history responses expose the source; both UIs label it **Arranged by admin**. The confirmation attests that the admin arranged coverage; it is not evidence of a worker's in-app response.

Both paths retain the same agency/role guards, organization-first locks, active-worker checks, selected-slot availability, conflict and hours checks, replacement-date rules, duplicate prevention and fresh validation on confirmation. Revision activation, old-schedule cutoff, shifts, notifications and activity remain in the existing approval transaction.

## Migration and rollout

Apply Alembic revision `2e11cbcf7fed` after `c4e9812ab760` **before deploying the new backend**, then deploy the frontend. Existing assignments receive `worker_interest`; the column rejects unknown values. Roll back application code without dropping this additive column. The migration intentionally refuses a destructive downgrade that would erase provenance.

The migration was exercised against an isolated PostgreSQL table containing existing assignments, checking the backfill and value constraint. This is not evidence that the entire historical migration chain was applied to a fresh Supabase project: those older migrations depend on provider-managed schemas. Hosted migration and agency acceptance remain release tasks.

## Verification evidence

Tests used fictional records in a dedicated local PostgreSQL database. Nothing was written to a hosted agency.

- **56 backend checks passed:** existing placement and assignment tests, new direct approval with no interest, partial then complete coverage, mixed origins, provenance, retained old history, scheduled visits, notifications, duplicate approval, direct replacement and overlap, and migration backfill/constraint.
- Rejection coverage includes missing arrangement confirmation, unacknowledged gaps, missing/stale review, changed source, inactive/cross-agency/non-worker selections, availability, conflicts, hours, duplicate and unknown slots. A notification-write failure rolls back direct assignments and old-schedule changes.
- **Two real browser → FastAPI → PostgreSQL workflows passed**, one from each entry point. They test a blocked over-hours worker, required confirmations, multi-slot partial approval, later completion, unchanged workspace location and persistence after reload. The October 20 UI revision replaces search/filter checks with dropdown grouping and draft retention across tabs. The browser's identity and unrelated shell responses are fixtures; route guards are covered separately by the backend tests.
- Existing Care Requests browser regressions passed: interested-worker approvals, partial/full coverage, conflicts, stale review, close failure/retry, posting, empty states and responsive layout.
- Six selection/projection tests, touched frontend/backend lint and the production frontend build passed. The build retains its existing large-bundle warning.

## Running the checks

`.github/workflows/care-assignment-tests.yml` defines a disposable PostgreSQL and browser CI job. Its first remote run is pending. It initializes model tables and tests this migration independently; it never connects to hosted infrastructure.

Locally, set `CARE_TEST_DATABASE_URL` and `DATABASE_URL` to an initialized isolated PostgreSQL database whose name ends in `_test`. Never point these tests at an agency database. From `backend` run:

```text
python -m pytest tests/services/test_placement_assignment.py tests/services/test_assignment_management.py tests/integration/test_care_coverage.py -q
```

For browser tests, start Vite on `127.0.0.1:5198` with `VITE_BACKEND_API_URL` and `VITE_SUPABASE_URL` both set to `http://127.0.0.1:5198`, plus dummy public auth/Stripe keys. Set `CARE_REQUEST_TEST_URL` to that URL. Install Playwright in `admin-frontend` or set `PLAYWRIGHT_MODULE` to its installed module path. `BROWSER_CHANNEL` defaults to `msedge`; CI uses `chromium`.

From `backend` run:

```text
python -m pytest tests/integration/test_direct_assignment_browser.py -q
```

From `admin-frontend` run:

```text
node --experimental-strip-types --test tests/care-requests.test.mjs
node tests/care-requests.browser.cjs
```

The real browser integration harness binds only to loopback, overrides identity in the test app, and rolls back its database transaction. It is never mounted in the production application.
