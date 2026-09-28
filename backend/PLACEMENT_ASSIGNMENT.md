# Office placement assignment

Admins can select a worker on an open placement without a prior worker-interest
record. The confirmation explicitly asks them to arrange coverage with the worker
and review the placement requirements. It creates recurring shifts from the
placement's saved care-plan snapshot. It does not fabricate worker interest.

- `GET /placements/{placement_id}/workers/{employment_id}/eligibility` previews
  availability, existing shift conflicts, overtime, and the worker's weekly cap.
- `POST /placements/{placement_id}/assign` takes `employment_id` and checks again.
- Existing `/fill` retains its requirement for worker interest and shares the
  assignment transaction. Both require an active, non-deleted worker in the agency.
- Assignment takes the existing billing cutoff/agency lock before the placement
  lock and eligibility checks. Closing takes locks in the same order. A repeated
  request after assignment returns `PLACEMENT_NOT_OPEN` without more shifts.
- Shift creation, placement status, and in-app notifications share one commit.
  Failures roll back. The browser refreshes placement and schedule data even after
  an unsuccessful request so an uncertain response can be reconciled.
- Empty, invalid, or overlapping plans and windows without visits are rejected.
  Requirements written as free text need human review; they are not automatically
  checked against credentials. There is no overtime override in this flow.

The existing scheduling horizon is retained: up to one year ahead, or the current
funded authorization end if earlier. Open-ended recurrences are not a guarantee
against conflicts beyond that horizon. This does not add EVV or push delivery.

Local tests cover eligibility rejection, preview/confirmation changes, repeated
assignment, rollback calls, route guards, generated shifts, and real repository
worker filtering. UI checks cover rendering, TypeScript and production build.
Before release, exercise the full interaction in staging and simultaneous
assignment/ordinary scheduling/close requests against PostgreSQL. SQLite and mock
tests do not establish production lock behavior. No migration is needed.
