# Service type retirement

Implemented October 21, 2026 at the user's request during the client setup walkthrough.

Care Slots now describe a weekday and start/end times. Administrators no longer select a service category when saving weekly care or creating an independent visit. Client and worker visit views, care requests and assignments no longer display that category. Care metrics retain visit and hour totals without a service breakdown. Client care instructions and visit notes remain available.

## Data and compatibility

- Apply Alembic `6783506efc77` after `c8a1a667710e` before deploying the updated API.
- The migration makes `care_slots.service_type` nullable. Existing values in care slots, shifts and frozen request snapshots are retained as historical metadata, without participating in new care workflows. The legacy enum and model columns remain solely to preserve those values. New records have no fabricated default classification.
- Live request and response schemas omit service type. Older callers' extra service-type input is ignored by the existing Pydantic behavior. Updated clients must ship with the API: older mobile views that access the removed response field are not compatible.
- New request snapshots contain days and times. Existing structured snapshots are presented without classification; their stored text and JSON remain unchanged. Legacy free-text descriptions without structured slots remain historical text.
- Duplicate revision detection compares days and times; a retired category alone cannot trigger a new revision. Slot IDs, revision transitions and assignment history remain intact. Scheduling still checks availability, overlaps, hours, participant eligibility and reviewed state.
- Downgrade restores the old requirement only if no unclassified slots exist. It refuses to invent classifications for newer records.

## Verification

- 262 backend care, assignment, visit, domain and phone regression checks passed; 24 independent shift, time-contract, client-workspace and repository checks passed.
- Five retirement unit tests cover unclassified input, overlap rejection, legacy snapshots, duplicate revisions, old request compatibility and aggregate care totals.
- Thirty existing PostgreSQL care-coverage tests and two retirement tests passed. The migration test compares care slots, visit timing/notes and frozen requests before and after; the workflow test reviews and approves unclassified slots.
- Client setup and Care Requests browser suites passed, including posting, partial/full approval, conflicts, stale review, failure handling and tab selection retention. Two browser → API → PostgreSQL tests passed for direct assignment from both entry points.
- Admin build and scoped lint passed; mobile type checks and 21 schedule/inbox checks passed. Existing build chunk-size warning remains.

## Local and hosted status

Applied to the local walkthrough database on October 21. Before/after comparisons confirmed identical existing rows in clients, weekly care needs, care slots, placements, care slot assignments, shifts and progress notes. The local API and frontend use the updated implementation. Hosted migration and deployment remain pending.
