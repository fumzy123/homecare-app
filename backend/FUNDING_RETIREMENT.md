# Funding retirement — October 21, 2026

Care Harbor now follows client intake → Weekly Care Need/revisions → Care Request
→ worker selection/review → approved visits → progress notes. The agency verifies
funding outside the application. Scheduling approval makes no funding-eligibility claim.

## Removed

- Funding tab, create/amend/cancel forms, funding history and setup detours.
- Funder/reference/coverage/allowance/contribution/invoice-destination records.
- Client funded/self-pay classification and agency authorization setting.
- Funding checks on revision saves and coverage approvals; funding-derived horizons
  and recurring-shift cutoffs; funding summaries, alerts and activity destinations.
- Funding API, repository, services, models and display-only enums.

Weekdays, service types and hours display now belong to `features/weekly-care-need`.
Client service summaries derive from care needs. Public privacy/DPA drafts and the
landing page describe the remaining functionality; legal review remains outstanding.

## Preserved

Weekly Care Needs and all revisions, Care Slots, worker interest/direct selection,
availability/conflict/worker-hours checks, approval tokens and transactions, replacement
and revision transitions, notifications, visit history and dates, clinical fields,
care instructions, agency notes, shift notes, progress notes, worker credentials and
Care Harbor subscription billing. Removing funding does not establish privacy readiness.

## Migration and rollout

Deploy backend and frontend with Alembic `c8a1a667710e`, following `2e11cbcf7fed`.
The migration deletes `authorization_services`, `authorizations`, funding activity
events (their read markers cascade), `clients.care_arrangement`,
`organizations.uses_authorizations`, and the unused funding enum types.

No archive is created, as authorized for this unlaunched app. Downgrade intentionally
fails because deleted funding data cannot be reconstructed. Historical migrations stay
in the migration chain. All existing shift dates, including `recurrence_end_date`, are
left untouched; new recurring approvals have no funding-derived end date.

Applied to the isolated local test database and local development database on October
21. Before/after row fingerprints matched for all seven tables: shifts, modifications,
weekly care needs, care slots, assignments, progress notes and credentials. No hosted
database migration or deployment was performed.

## Validation

- 156 backend tests passed, covering scheduling, revision/assignment transitions,
  direct selections, tenant isolation, worker notes/clients, attention and cleanup.
- The PostgreSQL cleanup test constructs fictional funding data and read markers,
  deletes them through the actual migration, and checks retained visit dates, care
  instructions, agency/shift/progress notes and unrelated activity. Its transaction
  rolls back. Requires `CARE_TEST_DATABASE_URL` ending in `_test`.
- 10 frontend care/date/selection tests passed.
- Browser `tests/client-setup.browser.cjs` passed intake failure/retry, direct handoff
  without funding, revision/posting, partial direct assignment, first-visit navigation
  and save-and-return with directory filters. Unhandled API requests fail the test.
- Browser `tests/care-requests.browser.cjs` passed partial/full approval, conflicts,
  stale reviews, close failure/retry, posting and responsive layouts.
- TypeScript, focused ESLint and the production build passed. The build retains
  the existing large-bundle warning; it is not a compilation failure.

The CI care-assignment workflow includes the funding cleanup and API-contract tests.
Local tests are not hosted acceptance or legal/privacy sign-off.
