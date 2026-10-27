# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository. It serves as the single source of truth for the project's state, architecture, and backlog.

---

## What This App Is

An enterprise web + mobile application for Home Care Agencies to manage clients/patients and Home Support Workers. It replaces manual processes like Excel sheets and physical files.

### Two Primary Stakeholders
- **Agency Admin (desktop web app)** — manages clients, workers, scheduling, compliance. Target MVP.
- **Home Support Worker (mobile app)** — views shifts, documents visits, submits progress notes. Post-MVP.

---

## Monorepo Structure

```
homecare-app/
  backend/           ← FastAPI (Python) REST API
  admin-frontend/    ← React + TypeScript admin web app
  worker-mobile-app/ ← React Native + Expo mobile app
  docker-compose.yml ← Local dev (runs both backend + DB)
```

No monorepo tooling (Turborepo/Nx). Each app manages its own dependencies independently.

---

## Tech Stack

| Layer | Tool |
|---|---|
| Backend framework | FastAPI + Uvicorn |
| Auth | Supabase Auth (JWT only) |
| Data queries | SQLAlchemy 2.0 + psycopg2 → Supabase PostgreSQL |
| Migrations | Alembic |
| Validation | Pydantic v2 |
| Payments | Stripe |
| Task scheduler | APScheduler |
| Web framework | React 19 + Vite + TypeScript |
| Mobile framework| React Native (0.86.3) + Expo (SDK 57) + NativeWind v4 |
| Routing | TanStack Router (file-based) |
| Server state | TanStack Query + Axios |
| Client state | Zustand (auth only) |
| Forms | TanStack Form + Zod |
| Styling | Tailwind CSS v4 (hand-rolled components, no shadcn) |

---

## Architecture — Three-Layer Pattern (Backend)

The backend follows a strict three-layer architecture across all 8 service groups:

```
Router → Service → Repository → Database
```

- **Router** — HTTP only. Declares a factory function (`get_X_service`) that wires `db` and `current_user` via FastAPI `Depends`, then calls one service method and returns the result.
- **Service** — Business logic and transaction ownership. Class-based with `__init__(self, db, current_user)` that instantiates the repo and resolves shared context (e.g. `self.org_id`) once. Owns `db.commit()` and `db.rollback()`.
- **Repository** — Data access only. Takes `db: Session` in `__init__`. Named methods replace all raw `db.query()` calls. Never commits.

### Domain layer (`app/domain/`) — shared business rules

Some business rules don't belong to a single service — they're pure logic about
the *problem* (home-care scheduling), shared by multiple services. Those live in
`app/domain/`, **below** the service layer (the request path is still
Router → Service → Repository; services delegate *into* domain, the same way they
call repositories). A domain object is **not** a `Service`: no router factory, no
transactions, no `current_user`. Two kinds:

- **Pure functions** — data in, decision out, no I/O. E.g.
  `domain/availability.py::availability_covers_care_need(availability, care_slots)`;
  the occurrence/RRULE math in `domain/scheduling.py` (`expand_occurrences`,
  `timeblock_for_occurrence`, `iso_week_range`, `care_slots_to_time_blocks`).
- **Repository-backed collaborators** — read-only, `__init__(self, db, org_id)`,
  no commits. E.g. `domain/scheduling.py::SchedulingChecker` (`find_conflicts`,
  `find_hours_violations`), used by both `ShiftService` and `PlacementService`.

Rule of thumb: if logic is reused across services and needs no transaction/identity,
it's domain — name it by capability, **not** with a `_service` suffix.

### Service naming conventions

Each service class names its repo attribute after its domain:
- `self.client_repo`, `self.leave_repo`, `self.note_repo`, `self.invitation_repo`
- `self.org_member_repo`, `self.org_repo` (used by both OrgService and BillingService)
- `self.shift_repo` + `self.modification_repo` (ShiftService has two)

Each route parameter is named after the service type:
- `client_service`, `leave_service`, `note_service`, `invitation_service`
- `org_member_service`, `org_service`, `billing_service`, `shift_service`

### Services with mixed auth requirements

Three services have routes with different auth levels and handle `org_id` differently:

- **OrgMemberService** — `create_member` and `update_self` use `get_current_user`; admin methods use `require_admin`. Two factory functions: `get_org_member_admin_service` (resolves `org_id`) and `get_org_member_service` (does not). Constructor signature: `__init__(self, db, current_user, org_id=None)`.
- **OrgService** — Register routes have no org yet; `register_organization_direct` has no auth. Four factories for four auth levels. `get_admin_org_id` stays `@staticmethod` — it's a utility called by every other service's factory function.
- **BillingService** — Webhook has no auth (Stripe signature used instead). Two factories: `get_billing_service` (admin, resolves `org_id`) and `get_billing_webhook_service` (no auth, no `org_id`). Constructor signature: `__init__(self, db, current_user=None, org_id=None)`.

### Two-layer database access

- **Supabase Auth client** → identity only (sign-in, invite, JWT verification)
- **SQLAlchemy + psycopg2** → all business data (multi-table queries, scheduling, compliance)

### Authorization

Three FastAPI dependency guards in `app/core/security.py`:
- `Depends(get_current_user)` — any signed-in user
- `Depends(require_admin)` — `owner` or `agency_admin`
- `Depends(require_owner)` — `owner` only

Roles are `OrgMemberRole` enum: `owner`, `agency_admin`, `home_support_worker`.

---

## Frontend Architecture — 4-Layer Component Model

Every React component in `admin-frontend` (and `worker-mobile-app`) must fit one of four layers. When writing or reviewing code, identify the layer first, then enforce the rules for that layer.

### Layer 1 — Primitives
**Purpose:** Styling and interaction only. No awareness of domain, data, or app state.
**Examples:** `Button`, `Input`, `Avatar`, `Badge`, `Pill`, `StatusDot`, `ProgressBar`, `DateInput`, `TimeInput`
**Rules:** No `useQuery`, no API calls, no business logic. Props only: style, value, onClick, etc.
**Lives in:** `src/shared/components/ui/`

### Layer 2 — Compound Components
**Purpose:** Combine primitives into richer UI patterns. Still no data fetching.
**Examples:** `Modal`, `FormField`, `Drawer`, `StatCard`, `SectionHeader`, `AvailabilityGrid`
**Rules:** May manage local UI state (open/close, focus). Never calls `useQuery` or any API. Accepts data as props.
**Lives in:** `src/shared/components/` or within a feature's `components/` if domain-specific and not reusable

### Layer 3 — Domain / Business Logic Components
**Purpose:** Bridge between UI and data. Own data fetching, form state, and orchestration.
**Examples:** `LoginForm`, `WorkerDocumentsTab`, `ShiftCalendar`, `CreateShiftDrawer`, `DashboardStatsStrip`
**Rules:** May call `useQuery`/`useMutation`. Decides which Layer 1/2 components to render and what props to pass. Is domain-specific. If a component fetches data AND renders UI, it is Layer 3 — not Layer 2.
**Lives in:** `src/features/<domain>/components/`

### Layer 4 — Pages / App Shell
**Purpose:** Routes, layouts, global providers.
**Examples:** `__root.tsx`, `_protected.tsx`, `dashboard/index.tsx`, `workers/$workerId.tsx`
**Rules:** Composes domain components. Controls routing and layout. Handles global providers.
**Lives in:** `src/routes/`

### File placement rules
```
src/shared/components/ui/      ← Layer 1 (primitives only)
src/shared/components/         ← Layer 2 (compounds, no data fetching)
src/shared/components/layout/  ← Layer 4 shell pieces (Sidebar, Topbar — may use auth store)
src/features/<domain>/components/  ← Layer 3 domain components
src/routes/                    ← Layer 4 pages
```

### Custom hooks own all useQuery / useMutation calls

`useQuery` and `useMutation` must never appear naked in a component — always wrap them in a named custom hook in `src/features/<domain>/hooks/`. The hook encapsulates the query key, queryFn, and any config. Components (including routes) import the hook, not the raw query.

```
// Wrong — naked useQuery in a route or component
const { data } = useQuery({ queryKey: ['clients'], queryFn: clientsApi.listClients })

// Right — hook in features/clients/hooks/useClients.ts
export function useClients() {
  return useQuery({ queryKey: ['clients'], queryFn: () => clientsApi.listClients() })
}
// Route calls: const { data: clients = [] } = useClients()
```

Hooks live in `src/features/<domain>/hooks/<hookName>.ts`. One file per hook or one file grouping tightly related hooks (e.g. `useShifts.ts` exports `useTodayShifts`, `useWeekShifts`, `useDroppedShifts`).

### The key rule: don't mix data-fetching into Layer 2

If a component calls `useQuery`, it is Layer 3, not Layer 2. If you find a component that renders a card/chart/list AND fetches its own data, it must either:
- Accept data as props (move fetching up to the route via a custom hook), or
- Be explicitly treated as a Layer 3 domain component in `features/`

### Known violations (fix as you touch these files)

| File | Violation | Fix |
|---|---|---|
| `shared/components/layout/Sidebar.tsx` | Uses `useAuthStore` + `authApi.signOut()` — Layer 4 logic in Layer 2 location | Acceptable in `layout/` — layout components may use auth store for nav/logout |
| `features/clients/components/ClientStatusBadge.tsx` | Domain-specific badge in features/ | Could move to `shared/components/ui/` for reuse |
| `features/invitations/components/StatusBadge.tsx` | Same as above | Move to `shared/components/ui/` |
| `features/clients/components/ClientStatusBadge.tsx` | Domain-specific badge in features/ | Could move to `shared/components/ui/` for reuse |
| `features/invitations/components/StatusBadge.tsx` | Same as above | Move to `shared/components/ui/` |

---

## Environment Variables

### Backend (`.env.local` or `.env`)

```
SUPABASE_URL=
SUPABASE_SECRET_KEY=        # Secret key — backend only, never frontend
DATABASE_URL=postgresql+psycopg2://...
FRONTEND_URL=http://localhost:5173
STRIPE_SECRET_KEY=
STRIPE_STANDARD_MONTHLY_PRICE_ID=
STRIPE_STANDARD_ANNUAL_PRICE_ID=
STRIPE_FOUNDING_MONTHLY_PRICE_ID=
STRIPE_WEBHOOK_SECRET=
BACKEND_SENTRY_DSN=         # Optional, production only
```

### Admin Web Frontend (`.env.local`)

```
VITE_BACKEND_API_URL=http://127.0.0.1:8000
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=   # Publishable key — safe for frontend
VITE_STRIPE_PUBLISHABLE_KEY=
VITE_SENTRY_DSN=                 # Optional
VITE_APP_ENV=development
```

### Mobile App (selected environment file in `worker-mobile-app`)

`start:local` reads `.env.local`, `start:staging` reads `.env.staging`, and
`start:production` reads `.env.production`. Supply matching URLs and a public key
from the same environment. Neither the Git branch nor `APP_ENV` alone selects these.
Mobile `APP_ENV` is `local`, `staging` or `production`; local startup and the
`development` EAS profile use `local`. The four profile names stay `development`,
`development-staging`, `preview` and `production`; their EAS settings groups are
`development`, `preview`, `preview` and `production`, respectively, as documented
in `worker-mobile-app/README.md`. `NODE_ENV=development` describes Metro tooling,
not another backend environment. Existing app labels and package IDs are preserved.

```
EXPO_PUBLIC_BACKEND_API_URL=https://xxxxx.ngrok-free.app   # ngrok tunnel URL (see Mobile Dev Gotchas)
EXPO_PUBLIC_SUPABASE_URL=   # Local phone preview also needs a reachable auth URL/tunnel
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY= # Publishable key — safe for frontend
```

---

## Commands

### Backend

```bash
# Run locally (with hot reload)
cd backend
uvicorn app.main:app --reload

# Run via Docker (recommended — also starts migrations)
docker compose up

# Migrations
alembic revision --autogenerate -m "description"
alembic upgrade head
alembic downgrade -1
```

### Frontend

```bash
cd admin-frontend
npm run dev          # Vite dev server (http://localhost:5173)
npm run build        # TypeScript check + Vite build
```

### Mobile

```bash
cd worker-mobile-app
npm run start:local -- --tunnel --go
# Hosted staging accounts and backend:
npm run start:staging -- --tunnel --go
```

---

## Address autocomplete (2026-10-26)

Client intake/profile Street address uses `AddressAutocomplete` (Layer 3) and
`useAddressSuggestions`: three characters, 350 ms debounce, cancel stale browser
requests, five-minute memory cache, editable Canadian address fields and manual
fallback. The backend-only `GEOAPIFY_API_KEY` enables authenticated
`POST /api/addresses/autocomplete` via AddressService. No database changes.
Provider attempts have process-wide rolling limits (4/second, 30/user/minute,
2,500/day by default); these reset on restart and must become shared persistent
counters before using multiple backend processes. UI attribution is required.
See `backend/ADDRESS_AUTOCOMPLETE.md` for configuration, limitations and tests.

## Phone inputs (2026-10-21)

Admin client intake/editing, worker editing and account settings share the Layer 2
`shared/components/PhoneInput.tsx`. Canada is the default; the country selector and
`react-phone-number-input` handle international input and caret-aware formatting.
`shared/lib/phone.ts` uses `libphonenumber-js/max` for validation and E.164 normalization.
Errors appear on blur or submission. Optional blanks are saved as null (clearing an
existing number); client emergency phone is required. Full international numbers are
stored, and a leading North American `1` is not prefixed again.
Backend write schemas share `schemas/phone.py` with pinned `phonenumberslite`, including
worker-mobile profile writes. Response schemas and existing saved values are not rewritten.
Extensions are not supported in the phone field; malformed or extended API inputs are rejected.
This validates numbering rules, not ownership or reachability. Tests share international
fixtures in `backend/tests/fixtures/phone-cases.json`; run `tests/phone.test.mjs`, backend
`tests/test_phone_validation.py`, and the client setup browser suite.

## Email Confirmation

Registration uses Supabase sign-up and sends a confirmation email. The demo
`register-direct` bypass has been removed. Supabase must have Confirm email enabled.
After confirmation, `/confirm-email` automatically creates the organization, records
the accepted terms and opens the dashboard when a complete saved profile, explicit
agency timezone and current terms acceptance for the same email are available.
The discarded StrictMode load cannot submit setup. Failures retain signup details
and expose an explicit retry; missing details or consent show the completion form.
Signup profile details (never passwords or roles) are stored in Supabase user
metadata so confirmation works across browsers. Local storage remembers terms
acceptance for the original browser; other browsers request acceptance again.
Allow `/confirm-email` for each frontend URL in Supabase Auth URL Configuration.
Templates live in Supabase Authentication → Emails; Resend handles SMTP delivery.
Local confirmation is enabled in `supabase/config.toml`; emails go to the local
inbox at `http://localhost:54324`, using `supabase/templates/confirmation.html`.
Local configuration does not update hosted staging or production projects.
Validation: `tests/email-confirmation.test.jsx` and `tests/registration-timezone.test.mjs`
in `admin-frontend`; the local inbox walkthrough on 2026-10-15 verified an unconfirmed
signup creates no agency, then email verification completes setup without a second
form submission, retaining one owner membership and a 14-day trial.

---

## Scheduling — Current State (branch: feat/scheduling-improvements)

### Double-booking prevention (done — 2026-05-22)

`ShiftService` enforces no worker can be scheduled in two places at once via conflict checks in `create_shift`, `edit_from_date`, `create_modification`, and `update_modification`. All raise **409 `WORKER_ALREADY_SCHEDULED_AT_THIS_TIME_BLOCK`**.

Frontend catches this and displays the localized times to the admin.

### Workers schedule view (2026-10-26)

Schedule now offers Calendar / Workers with shared dates and worker/client filters.
Calendar keeps Week/Month and the left time axis; simultaneous events use side-by-side
layout, wrapped labels and horizontally scrollable space. Workers displays Sunday–Saturday
columns, sticky worker names, weekly hours for the shown client filter, stacked status
cards and native horizontal scrolling. The worker column uses warm cream shading;
the bottom helper strip and Earlier/Later buttons have been removed. Cancelled/dropped visits remain visible but do
not contribute hours. Overnight cards appear on each affected day without double-counting
hours. Both views open the existing visit details/editing workflow.

The Layer 3 `ShiftCalendar` coordinates named hooks; `WorkersSchedule` and
`ScheduleToolbar` are controlled Layer 2 components. The calendar hook opts into
`GET /api/shifts?calendar_window=true` for effective interval overlap (including visits
moved across weeks and overnight carry-in). Original occurrence dates remain response
identities. Default API queries and attention deep links retain original-date semantics.
The backend uses ShiftService → ShiftRepository with pure calendar projection in
`domain/scheduling.py`; tenant, worker/client, status and series cutoffs remain enforced.
No migration is needed; deploy the API with the updated frontend.

Validation: `tests/services/test_calendar_window.py`, existing scheduling domain/service
regressions, `tests/worker-schedule.test.jsx`, `tests/shift-save-recovery.test.jsx` and
`tests/workers-schedule.browser.cjs`. The browser suite uses fictional intercepted data
and dummy Vite auth/API configuration at `http://127.0.0.1:5201` (`SCHEDULE_TEST_URL`);
set `PLAYWRIGHT_MODULE` for a shared installation and optionally `SCHEDULE_SCREENSHOT_DIR`.
Hosted rollout and agency acceptance remain pending.

### Remaining scheduling release work (updated 2026-10-16)
- Overtime limits and owner override are implemented. The 2026-10-15 staging
  agency walkthrough rejected a 42-hour week without override and accepted an
  owner override with its history recorded. The separate admin-request/owner-review
  inbox journey still needs end-to-end acceptance; do not describe all overtime
  prevention as unbuilt. See `docs/staging-agency-walkthrough-2026-10-15.md`.
- Worker push registration and scheduling-event delivery are implemented. Cloud
  rollout and physical-device acceptance are separate from the admin web release;
  see `backend/WORKER_PUSH.md` and the mobile release checklist below.
- Direct Care Slot assignment is implemented (2026-10-16). Both Care requests and
  client Weekly care need → View posted care request offer active agency workers,
  including workers without interest. Each slot's dropdown groups interested workers
  first, then other active workers; there is no separate worker search/filter.
  Coverage and Interested workers tabs retain the same draft selections (2026-10-20).
  Direct selections carry `admin_arranged`
  provenance and require the admin's coverage-arrangement confirmation. Existing
  interest selections default to `worker_interest`. Both use the existing review,
  eligibility, locking, transition, notification and history transaction.
  Apply migration `2e11cbcf7fed` after `c4e9812ab760` before deploying the API.
  Local PostgreSQL/browser evidence and test instructions: `backend/DIRECT_ASSIGNMENT.md`.
  Hosted rollout and agency acceptance remain pending.

### Admin web release planning

`docs/admin-release-checklist.md` tracks the first-agency admin release separately
from Android. `docs/admin-workflow-review.md` maps the current admin journeys and
proposes targeted consolidation; `docs/admin-production-safeguards.md` explains
security, recovery and operating checks. These plans do not constitute production
configuration changes or release sign-off. Historical staging evidence remains in
the dated October 15 reports.

### Offline visit saving (2026-10-23)

Visit edit/cancellation mutations run without TanStack Query offline queuing or
automatic retries. A connectivity guard fails before sending while offline; the
edit draft stays open with an explicit Retry save action. Reconnecting alone does
not submit it. Active saves disable repeat submission, scope changes and discard.
Network/timeout errors preserve transport codes and explain an uncertain outcome;
they do not promise the server made no change. New-visit creation uses the same
connectivity guard. Validation: `tests/shift-save-recovery.test.jsx` and the isolated
`tests/scheduling-feedback.browser.cjs` (dummy Vite auth/API on port 5198) cover
offline recovery, failure/retry and single-occurrence scope. This does not add
persistent offline storage or change unrelated application mutations.

### Scaling prep (do before running >1 backend process/replica)
The APScheduler instance lives **in-process** (see `app/main.py` `lifespan`). With
more than one web worker/replica, each process starts its own scheduler and every
job (e.g. `mark_shifts_completed`) runs N times in parallel → duplicate work/races.
Before scaling horizontally, do one of:
- Run the scheduler in a **dedicated single process** (split it out of the web
  workers), **or**
- Add a **shared jobstore + locking** (e.g. `SQLAlchemyJobStore`) / leader election
  so a job is claimed once across instances.
Until then jobs must stay **idempotent + self-healing** (own DB session, re-scan a
lookback window, skip already-finalized rows) — see `app/jobs/shift_completion.py`.

---

## The Care Chain — Weekly Care Need → Scheduled Care

A **Weekly Care Need** is the client's recurring demand;
a **Care Slot** is one weekday and time interval within a version of that need.
Worker availability is capacity, and approved shifts are scheduled delivery.

### Service type retired (2026-10-21)

Care Slots now contain weekday and start/end times, without service classification.
Admin and mobile displays, new care/visit inputs and API responses omit service type;
care reporting retains overall visit/hour totals. Care instructions and all scheduling
safeguards remain. Migration `6783506efc77` after `c8a1a667710e` makes the old care-slot
column nullable. Existing classifications and frozen snapshots remain historical
metadata only; new records do not receive an invented category. Updated clients and
API must be released together. Local migration and regression checks passed; hosted
rollout is pending. See `backend/SERVICE_TYPE_RETIREMENT.md`.

Use these names throughout the stack:

| Concept | Model / frontend | Table | API |
|---|---|---|---|
| Versioned weekly demand | `WeeklyCareNeed` | `weekly_care_needs` | `/clients/{id}/care-need` |
| Individual recurring requirement | `CareSlot` | `care_slots` | Nested in the Weekly Care Need |
| Approved slot coverage | `CareSlotAssignment` | `care_slot_assignments` | `/placements/{id}/approve` |
| Worker availability | `WorkerAvailabilityEntry` | `worker_availability_entries` | `/org-members/{id}/availability` |
| Scheduled visit series | `Shift` | `shifts` | `/shifts` |

### Version and approval flow

- Saving creates an immutable version with `created_at` and proposed `effective_from`.
  Its Care Slots retain their IDs and history. Saving or posting never generates shifts.
- Revisions may be saved before an approved future revision starts (2026-10-21).
  The proposed date may be today or any future date, including before the queued
  revision. Approval shortens all affected predecessor schedules from that date;
  it never revives an older schedule. Revisions replaced before starting retain
  their history and display **Replaced before starting**. Saving and reviewing
  leave existing visits unchanged. PostgreSQL regression tests cover replacement
  before/on/after a queued start, another earlier replacement, and retained history.
- **Post care request** advertises one whole version. Workers express interest in
  one, several or all available Care Slots. Interest does not reserve coverage.
- The admin selects interested workers or active agency workers with whom coverage
  was arranged outside the app, reviews availability/conflicts/hours,
  and chooses **Approve and schedule**. Partial approval is supported, with explicit
  acknowledgment of the remaining uncovered Care Slots.
- First approval records `scheduled_from` and activates the new version. In the same
  transaction, all recurring coverage linked to the previous version ends the day before
  that date. Old Friday coverage never continues merely because new Saturday is open.
  Past visits and modifications remain. Unrelated one-off shifts are unaffected.
- Subsequent approvals add only uncovered Care Slots. Organization-first locks, a reviewed
  state token and unique slot assignments prevent stale/double approvals. Eligibility is
  rechecked at confirmation. Ordinary shift edits cannot extend an ended version.
- In-app notifications are written in the approval transaction: selected workers receive
  confirmation and all active agency workers receive the approved and remaining slots.
  No external message broker or background delivery process is required for this flow.
- `/care-actions` supplies dashboard actions for unpublished versions, pending interest,
  uncovered slots and proposed start dates reached before approval.

### Migration and history

Migration `5961f453498d` preserves existing care rows under an explicitly imported baseline.
Existing recurring shifts link to that baseline; exact slot links are not invented.
Existing one-off shifts remain independent. Legacy placement snapshots are retained and
read-only for assignment; save a new version to use slot approvals. The retired client
`assigned_worker_id` data is preserved in the private `legacy_client_worker_assignments`
archive. There is no single assigned-worker field in the live client model.

### Assignment management (2026-10-09)

Client **Assigned workers** (October 27, 2026) follows the selected revision in
`WeeklyCareNeedEditor`. Controlled `RevisionAssignments` cards group by immutable
Care Slot IDs, show current/upcoming worker periods and approved revision transitions,
and retain expandable history with reasons and explicit scheduled-change labels.
Coverage is counted once per slot on the displayed agency-local date (approved future
start, today, or a historical revision's end); assignment stop dates are exclusive.
Proposals, imported schedules without slot links and revisions replaced before starting
do not invent coverage. Manage assignment still groups selectable slots by worker and
care request and uses the existing review/token/end flow and server `can_end` guard.
The worker profile keeps its existing assignment list. No API or migration changes.
Validation: `tests/assigned-workers.test.jsx`, `tests/assigned-workers.browser.cjs`,
existing assignment, client setup and navigation browser checks. The browser fixtures
use dummy configuration and `ASSIGNMENT_TEST_URL` (default port 5199), with optional
`PLAYWRIGHT_MODULE` and `ASSIGNMENT_SCREENSHOT_DIR`. Hosted acceptance remains pending.

Worker Overview and client Weekly care need compose the same Layer 3
`features/assignments/components/AssignmentsPanel`. Controlled cards and the
review dialog are Layer 2; API queries/mutations live in named feature hooks.
Admins select recurring Care Slots and **Stop visits from** an agency-local date,
enter a reason, review, then confirm. This changes assignments, not employment.

`/api/assignments` uses AssignmentService → AssignmentRepository. Ending uses
organization-first locks, assignment/shift locks and a reviewed-state token.
`CareSlotAssignment.ends_before` is exclusive; rows retain end reason, actor and
timestamp. `Shift.assignment_id` links each generated/split series to its history.
The partial unique index permits only one unended assignment per Care Slot.
Replacement approvals check date overlap and must cover the next required future
visit; approve separately when selected slots have incompatible replacement dates.
Ending reopens the existing Care Request, and the Action Tower's existing stable
coverage case shows replacement demand from the first affected weekday. No new
action table or polling job is introduced. Approval refreshes assignment views.

Cutoffs reject changes that would hide elapsed, ongoing or documented visits,
including rescheduled visits crossing the boundary. Past notes are never deleted.
Linked recurring series cannot be reassigned, shortened or cancelled through the
old series-ending actions; use Manage assignment. Single-occurrence edits remain
available. Imported schedules without proven Care Slot links are not fabricated
into assignments and remain managed through their existing visit workflows.

Apply Alembic migration `b7f21c9064ab` after `de9e97b23461` before deploying the API.
Validation and staging walkthrough: `backend/ASSIGNMENTS.md`. This code change
does not apply hosted migrations or implement employment offboarding.

A client's **Care team** is derived from scheduled coverage. Worker client access is based
on retained, non-deleted shifts in the same agency, including past care history.

### Active and standby

**Active clients** counts clients with Active relationship status. **Active workers** counts
workers with Active employment status. Neither is a billing-period usage count.
**On standby** is derived within the active workforce: no ongoing qualifying visit and no
scheduled client visit from now through the next 14 days, inclusive. Cancelled, dropped,
completed and missed visits do not count; inactive/deleted clients do not keep a worker
scheduled. A distant next shift is shown separately. Employment status stays Active.
The indicator is computed from schedule data on reads (the roster refreshes every minute),
so no status-changing background worker or backdated assignment timer is needed.

### Funding retired (2026-10-21)

Client funding authorizations are outside the current product scope. The agency
checks funding outside Care Harbor. No funded/self-pay classification, allowance
checks, funding-derived scheduling cutoffs, funding endpoints or renewal alerts remain.
Weekly care revisions, selected-slot eligibility, worker-hours checks,
assignment transitions, credentials and progress notes remain. New recurring coverage
has no funding-derived end date; existing visit dates are never extended by migration.

Apply Alembic `c8a1a667710e` after `2e11cbcf7fed` with the updated app. It deletes the
retired pre-launch funding tables, funding activity, client classification and agency
setting. There is no funding archive or data-restoring downgrade. It does not modify
visits, care revisions, assignments, notes, worker credentials or subscription billing.
See `backend/FUNDING_RETIREMENT.md` for verification and rollout status.

### Admin Action Tower

`GET /api/attention-items` is an admin-only, organization-scoped read model:
`AttentionService` → `AttentionRepository`, with pure care-stage projection in
`domain/attention.py`. It combines the latest Weekly Care Need's posting, interest,
and uncovered-slot stages into one stable case per version, plus dropped visit
occurrences, expiring credentials and uploaded credentials awaiting verification.
Generic empty-week reminders were removed on October 23, 2026.
Dates use the agency's billing timezone;
recurring visit targets retain their original occurrence date even when rescheduled.

`features/attention/` owns the shared frontend hook, typed destinations and controlled
list. The protected shell hosts one provider: dashboard embeds the square list;
other admin routes show a circular launcher and rounded nonmodal panel. Selecting an
item opens the existing record workflow and minimizes the panel. Hide is session-only;
the topbar restores it. Existing modal overlays take precedence. Successful record
invalidations, focus and a 60-second poll refresh the feed; viewing an item does not
resolve it. No action table, migration, or manual completion endpoint is introduced.

Current windows remain 30 days for credential expiry
and 7 days back / 60 ahead for dropped visits. Missing/expired-record compliance rules,
onboarding is not a new tower check. Overtime requests and billing notices use their
existing workflows. Unread overtime decisions (October 23, 2026) are projected from
retained Activity events for the original requester only. Both outcomes include the
requested visit, decision reason (or an explicit absence) and View request. Opening
successfully marks the event read; it remains in Activity history. These updates do
not count as unresolved approvals and require no migration. Empty categories are omitted and a
failed feed is never displayed as all clear.

Validation: backend attention tests cover progression, deduplication, effective dates
and agency isolation. `admin-frontend/attention.browser.test.cjs` covers care and credential
destinations and shared UI behavior using intercepted fictional fixtures.
Run against local Vite with dummy public configuration (`VITE_SUPABASE_URL` and
`VITE_BACKEND_API_URL` matching `ATTENTION_TEST_URL`, default `http://127.0.0.1:5197`;
dummy publishable auth/Stripe keys). Set `PLAYWRIGHT_MODULE` to a shared Playwright
installation if it is not installed locally; `BROWSER_CHANNEL` defaults to `msedge`.

---

## MVP Scope — Home Care Agency Admin

### Visit drawers (2026-10-23)

New/Edit shift and visit management share the controlled Layer 2 `VisitDrawer`
and `VisitFormSection` in `features/shifts/components/VisitDrawerUI.tsx`. The
620px native dialog provides modal focus containment, Escape/close handling and
explicit focus restoration for nested recurring-scope review. Headers and action
footers stay visible while grouped form sections scroll. Domain drawers retain
form state, busy/dirty close guards, scheduling checks and existing API operations.
Date/time primitives accept optional accessible labels for their picker buttons.
Recurring scope labels explain single, following and whole-series changes; worker,
client, location and repeat settings remain series-only in this existing API.
Validation: `tests/visit-drawers.browser.cjs`, `tests/shift-save-recovery.test.jsx`
and `tests/scheduling-feedback.browser.cjs` use fictional fixtures to verify draft
retention, scope/focus behavior, error recovery, recurrence and responsive layouts.

### Team & invitations (2026-10-23)

Settings defaults to **Staff members**, listing joined managers, supervisors,
financial officers and nurses with name, email, role and active/inactive status.
Owners remain in their own section. **View profile** expands recorded phone,
employment type and hire date without navigating into worker scheduling screens.
**Pending invitations** includes expired invitations with resend/revoke controls;
worker invitations remain on Workers. `features/settings/hooks/useTeamDirectory`
uses existing organization-scoped member/invitation APIs, refreshing on focus,
reconnection and every minute while mounted. No backend or migration change is
required. Loading/error/retry states are explicit and refresh preserves tab choice.
Tests: `tests/team-directory.test.jsx` and `tests/team-directory.browser.cjs` in
admin-frontend (isolated fictional API/auth on port 5198).


### Compact client directory (2026-10-26)

The directory shows weekly hours and slot count, with compact coverage labels
(`N/N covered`, `N slots open`, `Unassigned`). City retains the street beneath it;
age appears before Location. Each highlighted-on-hover row opens the client profile
through one keyboard-accessible link, without an underlined name or arrow column.
Upcoming approved care says `Scheduled from`; proposals say
`Requested from`. Current care stays primary, followed by the next approved plan
when there is no current care, then the latest proposal. A newer proposal shows
`Revision pending`; an approved future change shows its date without replacing
the current summary. No care shows `Not set up` / `No care slots yet`.

`ClientResponse.directory_care` is an organization-scoped read projection using
the agency's local date and batched care versions/assignments. Coverage checks
assignment periods for each slot's next required occurrence, not individual visit
cancellations or worker interest. Imported coverage is explicitly unknown. No
migration is needed. Tests: backend `tests/services/test_client_directory.py`,
frontend `tests/client-directory.test.jsx` and `tests/client-directory.browser.cjs`.
The browser test uses isolated dummy API/auth configuration on port 5196 and accepts
`CLIENT_DIRECTORY_SCREENSHOT_DIR` and `PLAYWRIGHT_MODULE`. Hosted rollout is pending.

### Client workspace (2026-10-01)

The admin client routes now share the Care Harbor workspace layout: client directory,
Overview (the client index), Visits & metrics, Weekly care need, Progress
notes, and grouped profile editing. The header is the single profile-edit entry.
Client creation uses a three-step intake drawer. Components and query/mutation hooks
live in `features/clients`; routes only compose them.

Use **revision** in the weekly-care UI. The existing `version` API/database field is
retained for compatibility. Creating a revision preserves history and creates no
visits; posting and approving still use the existing placement workflow and checks.

Weekly care editing uses the visual Sunday–Saturday board (2026-10-21).
`WeeklyCareBoard` is a controlled Layer 2 component: per-day Add buttons, compact
day/time dialogs, optional copies to other days, and desktop drag-to-move. The day
selector supports keyboard/touch moves. Each card is an independent draft slot;
editing one day does not alter another. `WeeklyCareNeedEditor` owns validation,
draft state and saving through existing hooks. Overlaps are rejected without
moving/changing the original slot. Failed saves retain the draft; cancelling a
revision retains saved care. `tests/client-setup.browser.cjs` exercises these
interactions, responsive controls and the full posting/approval handoff. No new
backend rules or migration are required for this editor.

Client responses include `current_care_need`, derived in bulk for the directory.
`POST /api/shifts/{id}/notes/entries` appends admin follow-ups with an expected entry
count under the same shift lock used by worker notes. It preserves existing entries
and rejects stale writes. Monthly client notes include `worker_id` for filtering.

Validation: frontend `tests/client-care.test.mjs` covers current revision selection,
and slot/visit calculations; backend `test_client_workspace.py` covers the
current-care projection and safe note appends. `admin-frontend/tests/client-workspace.html`
is a development-only component verification host with an in-memory API adapter;
it is not a production entry point and never reads or writes agency records.

Client setup handoffs (updated 2026-10-21): successful intake offers Continue setting
up care → Weekly care need, or Back to clients, preserving the directory filters.
Partial/full approval links to the first newly
scheduled visit via the visits route's validated optional `week` query parameter.
`ClientCareMetrics` opens that week and retains This week navigation. No backend
scheduling rules changed. `tests/client-setup.browser.cjs` covers the full UI path,
failed saves and draft preservation using intercepted fictional records; the
existing real-database direct-assignment browser suite remains separate.

### Care Requests workspace (2026-10-02)

Request/revision navigation (2026-10-21): the request header's **Open weekly care
need** opens its exact revision in the client workspace. The validated `need`
search parameter selects the revision. Every posted revision offers **View posted
care request** as its primary action, opening the full request page. The duplicate
Review coverage dialog and Back to care request link were removed at the user’s request. Unsaved
revision edits remain protected. An explicit same-tab trip keeps draft worker
selections, coverage date and tab in a one-use, user/request-scoped memory cache
(up to 30 minutes, cleared on reload/sign-out); review tokens and confirmations
are never carried over. Existing eligibility and stale-review checks still apply.
The request summary groups requested start, weekly care, scheduling and posted
date, and separates the existing posted requirements/additional-notes text for
display. No stored postings or scheduling rules change. Browser coverage in
`tests/care-requests.browser.cjs` includes exact-revision navigation, revision switching,
draft preservation, discard protection and responsive layout.

The admin UI calls placements **Care requests**. Existing `/dashboard/placements`
links, API paths, query keys and stored domain names remain compatible. The directory
defaults to open requests, sorted by care request start date, with client, coverage
fraction/segments and interested-worker count. Detail pages show the revision in the
header, grouped request details, Care coverage / Interested workers views, and a
coverage plan using actual slot durations. Closing is a header button with confirmation;
approved visits remain scheduled.

`features/placements/components` owns queries and workflow orchestration. Controlled
work/review components receive props; routes compose the directory and detail coordinator.
Posting previews the saved revision before submission. Optional additional notes share
the existing worker-visible `requirements` field, separated by an Additional notes label.
Review tokens, eligibility blockers, uncovered-slot acknowledgement and unsaved-selection
navigation protection are retained. Create/close/approve refresh the Action Tower.

Validation: `node --experimental-strip-types --test tests/care-requests.test.mjs`
from `admin-frontend` covers ordering and selection projection. Run
`tests/care-requests.browser.cjs` against Vite with dummy public configuration on
`http://127.0.0.1:5198` (override `CARE_REQUEST_TEST_URL`). Point `VITE_SUPABASE_URL`
and `VITE_BACKEND_API_URL` at that server, use dummy publishable auth/Stripe keys,
and set `PLAYWRIGHT_MODULE` to a shared installation if needed. All API responses
are intercepted fictional fixtures; tests cover posting, partial/full approval,
conflicts, stale review, close failures, tower navigation and responsive layouts.

### 1. Profile Management
- **Clients**: Create, Read, Update, Delete
- **Workers**: Create (via Supabase invite), Read (profile + shifts), Update, Delete

### 2. Scheduling
- **Shift Creation**: Single shift or multiple shifts bulk creation

---

## Full Feature Backlog (Post-MVP)

1. **Compliance Documents Tracking**: Admin uploads First Aid/VSC/License for workers, sets expiry date, views status.
2. **Visits + Progress Notes**: Mobile app visit check-in/out.
3. **Flowsheets**
4. **GPS arrival/departure verification**
5. **Voice to notes**
6. **Export reports**
7. **AI Smart Scheduling**: Suggest best worker based on schedule and proximity.

---

## Worker Mobile App — Architecture

```
Screen (app/**/*.tsx)
  → hooks from src/features/X/hooks/
    → api.ts (TanStack Query wrappers)
      → src/shared/lib/api-client.ts (Axios + JWT refresh)
        → backend FastAPI
```

Shared design tokens match `admin-frontend/src/index.css` exactly.

### Mobile Stack Detail

| Concern | Tool |
|---|---|
| Framework | React Native + Expo SDK 57 |
| Language | TypeScript (strict) |
| Routing | Expo Router 57 (file-based, `app/` dir) |
| Server state | TanStack Query v5 |
| Client state | Zustand |
| Styling | NativeWind v4 (Tailwind in React Native) |
| Forms | TanStack Form v1 + Zod |
| Auth | Supabase (@supabase/supabase-js) |
| HTTP | Axios (`src/shared/lib/api-client.ts`) |
| Secure storage | expo-secure-store |
| Build | EAS Build + EAS Submit |

### Key Files

| File | Purpose |
|---|---|
| `app/_layout.tsx` | Root layout — fonts, providers, auth listener |
| `app/index.tsx` | Redirect: session → tabs, no session → onboarding |
| `src/shared/lib/api-client.ts` | Axios instance + JWT auto-refresh |
| `src/shared/lib/auth-store.ts` | Zustand session store |
| `src/shared/lib/query-client.ts` | TanStack Query global config |
| `src/shared/components/ui/index.tsx` | Design system components |
| `tailwind.config.js` | NativeWind — same tokens as admin-frontend |

### Worker Clients tab

The Clients tab lives in `app/(tabs)/clients/index.tsx`; client details live in
`app/clients/[clientId].tsx`. Routes compose the Layer 3 components in
`src/features/clients/components/`; queries and refresh orchestration live in
named hooks in `features/clients/hooks/`. Client cards, care fields and visit
cards are controlled Layer 2 components within the feature.

`GET /api/me/clients`, `GET /api/me/clients/{client_id}` and
`GET /api/me/clients/{client_id}/shifts?from_date=...&to_date=...` use
WorkerClientService → WorkerClientRepository / ShiftRepository. Access requires
an active worker and agency, and is scoped to the worker's agency and a retained active shift assigned to that worker.
Deleted clients/shifts do not grant access. Only care-facing profile fields are
returned; agency notes and financial details are excluded.

Visit history is browsable by month (at most 31 days per request), includes
cancelled occurrences, and opens the existing shift detail with its original
occurrence date. The existing progress-note flow supports append-only follow-ups
and corrections, preserving previous entries; it does not overwrite saved notes.

### Worker Android MVP — agreed scope (2026-10-02)

This defines the worker app's first Google Play release, separately from the
original agency-admin MVP above. Ship the existing core workflows plus push
notifications. Do not expand this release into the deferred features below.
Implementation checkmarks are not device-test or production-readiness sign-off.
The detailed release and device checklist is in
`worker-mobile-app/GOOGLE_PLAY_RELEASE.md`.

#### Core workflows implemented; still require release testing

- [x] App scaffold, design system, routing, sign-in, session storage and protected routes.
- [x] Web invitation/password setup followed by mobile sign-in; worker welcome,
      short introduction, skip and replay. In-app invitation acceptance is deferred.
- [x] Home, attention items, current/upcoming visits and estimated completed hours.
- [x] Schedule, week/two-week navigation, shift details, directions and care instructions.
- [x] Assigned clients, care-facing information and visit history.
- [x] Typed progress notes and append-only follow-ups per visit occurrence.
- [x] Own profile viewing/editing and credential upload/viewing.
- [x] In-app notification inbox and read state. Phone push delivery code is implemented;
      deployment and Android device verification are pending.

#### Must complete before the Android MVP release

- [ ] **Push notifications:** implement permission handling, device registration
      and removal/reassignment on sign-out/account changes, Android delivery
      credentials, backend dispatch and tap navigation. Minimum worker events:
      new assignments and schedule changes/cancellations. Keep patient details
      out of lock-screen text; opening a notification must still enforce access.
      Verify delivery and taps in foreground, background and closed-app states,
      plus denied permissions and invalid device tokens. Keep the inbox usable
      when phone notifications are disabled.
- [ ] **Minimum onboarding and truthful UI:** test web invitation → mobile login
      → welcome/skip → Home, returning sessions, and pending/expired/no-access
      accounts. Add contextual push permission handling. Remove or redirect old
      onboarding routes with sample completion data or promises of GPS,
      flowsheets and voice notes. Do not add a richer onboarding flow for MVP.
      Remove unused location permission requests/declarations. Keep weekly hours
      explicitly estimated and do not present punctuality as a working feature.
- [ ] **Production connections and account recovery:** configure the production
      website URL, verify compatible backend/auth services, and test privacy and
      password-reset links. Make recovery reachable before sign-in as well as
      from Settings. Finalize app name/version presentation and working actions.
- [ ] **Android release testing and necessary fixes:** create a signed build,
      test every core workflow on an Android phone with fictional records, and
      fix crashes, blocked journeys, lost notes, misleading errors and access
      failures. Cover denied permissions, network loss, session expiry, keyboard,
      back navigation and small screens. Cosmetic enhancements are not a gate.
- [ ] **Google Play submission:** verified developer access, final privacy policy,
      support details, accurate app/data declarations and applicable deletion
      flow, icon/screenshots/feature graphic, reviewer demo access, signed bundle,
      required testing for the account, and submission for review. Record the
      actual submission result; a bundle export or upload alone is not review.

#### After the Android MVP release

Next release, as requested:
- [ ] Visit check-in/check-out, GPS arrival/departure verification and handling
      denied or unavailable location.
- [ ] Actual worked hours and punctuality calculations based on recorded attendance.

Later releases (order to be decided after MVP feedback):
- [ ] Worker self-service availability editor and its complete save/test workflow.
      Partial implementation in the working tree does not make this an MVP gate.
- [ ] Invitation links opening the app and native account/profile setup.
- [ ] Richer onboarding: real profile-completion percentage and personalized
      missing-item checklist; additional guidance when useful.
- [ ] Voice-to-text progress notes.
- [ ] Digital flowsheets and per-visit care-task checklists.
- [ ] Attendance leaderboard, after attendance data exists.
- [ ] Additional animations, loading skeletons and contextual nudges beyond the
      loading/error/empty states required for reliable MVP use.
- [ ] iOS release testing, TestFlight and App Store submission; current launch
      focus is Android.

### Worker schedule implementation

`ScheduleView` is the Layer 3 coordinator. `useWorkerSchedule` owns period selection,
query composition and refresh through the existing shift/note hooks. Calendar controls,
date picker, visit cards, timeline and agenda are Layer 2 components that receive props.
`ScheduleCareDialog` is Layer 3 because it fetches visit details through a custom hook.
Pure date, selection and itinerary projections live in `features/shifts/lib/scheduleView.ts`.

The two-week view preserves its date range when a date in the second week is selected.
Totals are scheduled visit durations, excluding cancelled, dropped and missed visits;
they are not verified worked hours or payroll. The app has no agency payroll calendar
yet, so the label is **scheduled over 2 weeks**, not **pay period**. Note indicators
come from occurrence-specific recorded notes; updated visits do not invent previous times.
Run `npm run test:schedule` for date navigation, itinerary, hours and note-status checks.

### Mobile backend status

Profile read/update, credentials, notification history/read state, shifts,
clients and visit notes have worker endpoints. They are not missing MVP API work.
Push device registration and scheduling-event delivery are implemented; cloud
configuration and physical-phone acceptance remain release gates. Attendance/check-in/check-out and
leaderboard APIs are deferred. Availability work is also deferred from the MVP;
the current working tree has an availability endpoint/hook under development,
which is not evidence of a completed, tested mobile workflow.

---

## Local Mobile Development Gotchas

### Worker sign-in and privacy requests (2026-10-09)

Worker setup starts from the agency invitation email and is completed on the web
before mobile sign-in. The mobile app is for existing accounts: no sign-up,
invitation-acceptance redirect or account-deletion request entry. Keep password
recovery, legal links and agency support guidance. Reassess Play account-deletion
scope before introducing mobile account creation or links to account setup.

The public website retains `/account-deletion` for manually reviewed privacy
requests. `features/privacy` owns that page and validates the configured
`VITE_PRIVACY_CONTACT_EMAIL`. A missing contact is explicitly unavailable and must
be configured before publishing that request channel. Submission changes no records.

`backend/scripts/worker_account_deletion.py` is a trusted-operator CLI, never an
HTTP endpoint. AccountDeletionService → AccountDeletionRepository previews first,
checks exact Person/Auth/all employment IDs and a fresh review token, and requires
verified review plus a private receipt. Execution is restricted to closed,
terminated worker memberships. It removes Auth, push data/read markers and selected
profile/availability data; it preserves Person, employment and care history.
Retained categories require reasons/review dates. Active-worker requests remain
valid and need individual handling; do not terminate employment to satisfy a tool
guard. Auth and SQL are not atomic: see `backend/ACCOUNT_DELETION.md` for recovery,
retained credentials/history, provider/backups and case-completion work.

Validation uses fictional SQLite/mocked Auth tests in `test_account_deletion.py`,
the isolated web test `tests/account-deletion.browser.cjs`, and mobile website-link
tests. Production contact configuration, retention rules and real provider
verification remain prerequisites to operating the web request/cleanup process.
No account/data deletion was executed to build this workflow.

### Running the Mobile App on a Physical Device

For local testing, the phone needs three connections: Metro (the JS bundle), the
backend API, and local Supabase Auth. Expo's tunnel covers only Metro.

**Every time you start a dev session:**

1. Start local Supabase (`npx supabase start`) and the backend (`docker compose up`).
2. Run `ngrok http 8000`, copy the `https://xxxxx.ngrok-free.app` URL into `worker-mobile-app/.env.local` → `EXPO_PUBLIC_BACKEND_API_URL`
3. Expose local Supabase to the phone, for example `npx localtunnel --port 54321`.
   Set `EXPO_PUBLIC_SUPABASE_URL` in `.env.local` to that URL and use the local
   Supabase publishable key. Keep both service tunnels running.
4. Run `cd worker-mobile-app && npm run start:local -- --tunnel --go`.
5. Scan the QR code in Expo Go compatible with SDK 57.

For hosted staging, use `npm run start:staging -- --tunnel --go`; backend and auth
tunnels are unnecessary. `start:production` explicitly selects production services.
The launcher reads the matching environment file without overwriting `.env.local`.
See `worker-mobile-app/README.md` for configuration and EAS build environment setup.

**ngrok:** Microsoft Store install (v3.39.1), available in PATH as `ngrok`. Authtoken saved. Regenerate token at dashboard.ngrok.com if compromised.

### Expo Go vs Development Builds
- Android remote push requires an installed development or standalone build.
  Native notification imports are guarded before loading, so Expo Go still runs
  ordinary workflows and the API-backed inbox. Use `development-staging` with
  `npm run start:staging:dev -- --tunnel` for staging native development, or
  `preview` for standalone staging testing. Both execute on the phone; only the
  development workflow loads changing JavaScript from Metro on the computer.

### Push registration foundation (2026-10-02)

The `development-staging` EAS profile now installs a staging dev client, using
the preview environment and staging Firebase config. Push imports are guarded
before loading native notifications, so Expo Go can still run ordinary flows.
Settings offers an explicit phone-notification permission/registration action.
`features/notifications` owns the provider, named mutation hook and serialized
device lifecycle. The backend uses PushDeviceService → PushDeviceRepository;
Alembic `0ab31e782c90` creates the private, RLS-enabled `push_devices` table.
Logout revokes this installation before signing out locally; offline failures
show a retry message. Scheduling-event delivery is implemented as described below;
Android device testing and production setup remain required.

### Worker push delivery (2026-10-03)

Shift services enlist `WorkerNotificationService` to write individual inbox notices
and private `PushDelivery` rows in the scheduling transaction. Coverage approval
queues the existing selected-worker notices and notifies workers whose previous
coverage ends. Repositories only access data; service transactions own commits.
`domain/push.py` contains pure change projections and patient-free push content.

The APScheduler job uses `PushDeliveryService` → `PushDeliveryRepository` with
row locks and `ExpoPushClient` for HTTP. It checks current device ownership and
active worker/agency access before sending, retries transient errors, polls Expo
receipts and retires invalid tokens. Tap handling opens the authenticated inbox;
schedule notices lead to the schedule. Inbox UI is Layer 3 in the notification
feature, with named hooks and a composing route.

Migration `de9e97b23461` must precede deploying this code. Delivery defaults off:
set `PUSH_DELIVERY_ENABLED`, environment-specific `PUSH_ALLOWED_APP_IDS` and, when
Expo enhanced security is enabled, backend-only `EXPO_PUSH_ACCESS_TOKEN`.
`GOOGLE_SERVICES_JSON` supports an EAS file environment variable; staging also
supports the ignored local config. No credentials have been provisioned by this
code change. See `backend/WORKER_PUSH.md` for rollout, delivery guarantees and
the remaining physical Android checks. No device/release sign-off is implied.
