# Recurring assignment management

Admins can manage the same assignments from **Workers → worker → Overview →
Assignments** and **Clients → client → Weekly care need → Assignments**.

Choose **Manage assignment**, select the care slots, enter **Stop visits from** and
a reason, then review and confirm. The date is exclusive and uses the agency's
timezone. For example, stopping Friday coverage from October 16 removes visits
on October 16 and later while leaving Monday/Wednesday assignments unchanged.
The worker remains employed. Ended assignments are available through **Show ended
assignments**, with the original worker, dates and reason.

Confirmation preserves past visits and progress notes, ends only the selected
linked series, reopens its Care Request and refreshes the Action Tower. The
**Find replacement coverage** link opens the existing approval workflow with its
availability, conflict, hours and funding checks. Replacement coverage cannot
overlap the old assignment or start after the next required future visit while
silently clearing the gap. Approve slots separately when their dates differ.

The API requires agency-admin access and scopes every assignment/shift query to
that agency. Writes lock the organization, assignments and shifts, and recheck a
review token. Requests roll back together on failure. Existing series-ending
actions cannot bypass this workflow for linked assignments. Single-visit changes
continue to use the occurrence workflow.

If a cutoff would hide a past, ongoing, documented or rescheduled past visit,
choose a later date. An overnight visit crossing the boundary also requires a
later date. There is no automatic deletion or reassignment of clinical records.
Imported or individually scheduled visits without a proven Care Slot assignment
are not included in this management section.

## Migration and rollout

1. Apply `b7f21c9064ab` after `de9e97b23461` using the project's normal Alembic
   deployment process, before starting API code that reads the new columns.
2. The migration retains assignments, replaces the old one-row-per-slot unique
   constraint with one unended assignment per slot, and backfills shift links
   only where the existing Care Slot and worker match. It does not invent links
   for imported schedules. Downgrade refuses to discard assignment history.
3. On an isolated PostgreSQL database/staging with fictional data, verify a
   Monday/Wednesday/Friday assignment, end Friday from a future date, and check
   both admin entry points and the worker's future schedule.
4. Check earlier progress notes, unchanged Monday/Wednesday visits, the replacement
   Action Tower item and the reopened Care Request. Approve a replacement and
   check original authorship and absence of overlapping shifts.
5. Verify simultaneous confirmations: only one may succeed; the other must ask
   for a refresh/review. Verify a different agency cannot list or end these IDs.

No hosted migration or deployment was performed as part of this implementation.

## Local verification

From the repository root:

```powershell
backend/.venv/Scripts/python.exe -m pytest backend/tests/services/test_assignment_management.py -q -p no:cacheprovider
```

The tests use isolated SQLite records and cover partial ending, audit/history,
replacement approval, overlap/gap rejection, stale reviews, tenant isolation,
recorded/rescheduled visits and series-ending safeguards. SQLite does **not**
verify PostgreSQL row-lock semantics; use the rollout checks above for that.

`admin-frontend/tests/assignments.browser.cjs` exercises the real shared components
through a development-only fixture host. Run local Vite on port 5199 with dummy
public Supabase/API settings pointing at `http://127.0.0.1:5199`, then run the test
from `admin-frontend`. Set `PLAYWRIGHT_MODULE` to an installed Playwright package
if needed; `BROWSER_CHANNEL` defaults to `msedge`. All requests terminate in an
in-memory adapter. The tests never use agency credentials or modify real records.
