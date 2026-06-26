# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository. It serves as the single source of truth for the project's state, architecture, and backlog.

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
| Mobile framework| React Native (0.81.5) + Expo (SDK 54) + NativeWind v4 |
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
  `domain/availability.py::availability_covers_care_plan(availability, care_plan)`;
  the occurrence/RRULE math in `domain/scheduling.py` (`expand_occurrences`,
  `timeblock_for_occurrence`, `iso_week_range`, `weekly_entries_to_time_blocks`).
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

Every React **component** in `admin-frontend` (and `worker-mobile-app`) must fit one of four layers. When writing or reviewing code, identify the layer first, then enforce the rules for that layer.

Two kinds of code are **not components** and therefore sit *outside* the four layers — they live **below** Layer 3 and are imported *into* it, never the other way around:

- **Data-access hooks** — the `useQuery`/`useMutation` wrappers in `src/features/<domain>/hooks/` (see "Custom hooks own all useQuery / useMutation calls" below).
- **Domain logic** — pure functions (no React, no rendering, no I/O) that encode home-care business rules (see "Domain logic — pure rules below the components" below).

This mirrors the backend exactly: the four component layers are the frontend's `Router → Service` request path; the hooks are its data access; and the domain logic is the frontend twin of `app/domain/`. A component **delegates into** domain logic the same way a Service delegates into `app/domain/`.

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

### Domain logic — pure rules below the components

**Purpose:** Encode home-care business rules as pure functions — data in, decision out. No React, no rendering, no hooks, no API calls. This is the frontend twin of the backend's `app/domain/` layer, and it exists for the same reason: some logic is about the *problem* (cap normalization, over-cap detection, hours math, time formatting), not about any one component.
**Examples:** `entryHours(start, end)`, `computeOverplanned(rows, compliance)`, the bi-weekly→weekly normalization in the care plan, the localized-times formatter for shift-conflict (409) errors.
**Rules:** Imports nothing from React. A Layer 3 component imports and *delegates into* it; it never imports a component, hook, or anything that touches the DOM or network. Because it's pure, it's directly unit-testable (Vitest) with no rendering or mocking — this is where the highest-value, cheapest frontend tests live.
**Lives in:** `src/features/<domain>/<name>.ts` (e.g. `weekly-care-plan/carePlanMath.ts`). Promote to `src/shared/lib/` only when reused across features.

> Rule of thumb (same as the backend): if the logic renders nothing and needs no data fetching, it is **not** a component — pull it out of the Layer 3 component into a domain module and unit-test it there. Logic left inlined inside a component is the frontend equivalent of business logic stuck inside a Service method.

### File placement rules
```
src/shared/components/ui/      ← Layer 1 (primitives only)
src/shared/components/         ← Layer 2 (compounds, no data fetching)
src/shared/components/layout/  ← Layer 4 shell pieces (Sidebar, Topbar — may use auth store)
src/features/<domain>/components/  ← Layer 3 domain components
src/features/<domain>/hooks/   ← data-access hooks (useQuery/useMutation wrappers)
src/features/<domain>/<name>.ts    ← domain logic (pure rules, no React) — e.g. carePlanMath.ts
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
STRIPE_PRICE_ID=
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

### Mobile App (`worker-mobile-app/.env.local`)

```
EXPO_PUBLIC_BACKEND_API_URL=https://xxxxx.ngrok-free.app   # ngrok tunnel URL (see Mobile Dev Gotchas)
EXPO_PUBLIC_SUPABASE_URL=
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
npx expo start --tunnel --clear
```

---

## Temporary: Email Confirmation Bypass (REMOVE AFTER DEMO)

Email confirmation is currently **bypassed** for the demo (added 2026-05-21). Registration goes directly to the dashboard with no email sent.

**What was changed — revert all of this after the demo:**
- `backend/app/schemas/organization.py` — Added `RegisterDirectSchema`
- `backend/app/services/org_service.py` — Added `register_organization_direct()`
- `backend/app/api/routes/organization.py` — Added `POST /api/organization/register-direct`
- `admin-frontend/src/features/auth/api.ts` — Added `authApi.registerDirect()`
- `admin-frontend/src/features/auth/components/RegisterForm.tsx` — Bypasses email check

---

## Scheduling — Current State (branch: feat/scheduling-improvements)

### Double-booking prevention (done — 2026-05-22)

`ShiftService` enforces no worker can be scheduled in two places at once via conflict checks in `create_shift`, `edit_from_date`, `create_modification`, and `update_modification`. All raise **409 `WORKER_ALREADY_SCHEDULED_AT_THIS_TIME_BLOCK`**.

Frontend catches this and displays the localized times to the admin.

### Still to build on this branch
- Overtime prevention (max hours/week, approval by owner/manager)
- Push notification to workers when a new client is dispatched

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

## The Care Chain — Authorization → Plan → Delivery

Three objects sit at three levels: **entitlement → demand → supply**. The
client's weekly care plan is the linchpin — it's the only artifact that must
satisfy both the funder's cap *and* the agency's labor supply at once.

| Layer | What it is | Owner | Unit |
|---|---|---|---|
| **Authorization hours** | The funder's cap, per service | Health institution / funder | Per service, normalized to the **bi-weekly** payment window |
| **Weekly care plan** | Recurring weekly care entries (day/time/service) — `WeeklyCarePlanEntry` | Agency | **Weekly** (×2 to compare bi-weekly) |
| **Worker availability** | Recurring weekly windows a worker can work — `WorkerAvailabilityEntry` (+ `max_hours_per_week`) | Worker / agency | Weekly interval entries |

### Vocabulary — one name per concept, FE → BE → DB

The scheduling concepts use **one consistent name at every layer** so a new dev
never meets two names for one thing. The row-level noun is always **entry**.

| Concept | Frontend | Backend (model / service) | DB table | Route |
|---|---|---|---|---|
| Funder entitlement | `Authorization` | `Authorization` | `authorizations` | `/clients/{id}/authorizations` |
| Client's weekly care plan | `WeeklyCarePlanEntry`, `WeeklyCarePlanEditor` | `WeeklyCarePlanEntry` / `WeeklyCarePlanService` | `weekly_care_plan_entries` | `/clients/{id}/care-plan` |
| Worker availability | `AvailabilityEntry`, `WorkerAvailabilityEditor` | `WorkerAvailabilityEntry` / `WorkerAvailabilityService` | `worker_availability_entries` | `/org-members/{id}/availability` |
| Scheduled care | `Shift` | `Shift` | `shifts` | `/shifts` |
| Delivered care | (Attended shift — see Phase 8 EVV) | `Shift` (completed) | `shifts` | — |

The weekly care plan has **no parent row** — it *is* the set of
`WeeklyCarePlanEntry` rows for a client. For a **funded** client the tab is the
**Authorized Weekly Care Plan** (capped by the funder); for a **self-pay** client
it is simply the **Weekly Care Plan** (no cap, compliance off). Same route
(`/care-plan`) and same editor for both — only the label and `enforceCompliance`
differ. See [[project_org_member_architecture]] for the worker side.

### The relationships
- **Authorization → Weekly care plan = a ceiling (enforced, hard).** Planned
  hours per service must stay ≤ authorized hours. Enforced in the
  `WeeklyCarePlanEditor` (funded clients only): `Within cap / Over cap` pills,
  and **Save is blocked over cap**. Units differ (auth = bi-weekly, plan =
  weekly), so the plan is normalized `weekly × 2` before comparing. This is why
  the authorization card shows *only* authorized hours — comparing plan-vs-auth
  in place mixes units.
- **Weekly care plan → Worker availability = staffing feasibility.** The plan is
  *demand* (when/what care is needed); availability is *capacity* (who can cover
  it). A worker can take an entry only if available, under max hours, and not
  double-booked. Enforced today: **double-booking** (409
  `WORKER_ALREADY_SCHEDULED_AT_THIS_TIME_BLOCK`). Overtime/availability are
  softer (overtime prevention is backlog; availability is an input to *who you'd
  pick*, not a hard gate yet).
- **Authorization ↔ Worker availability = no direct link.** They only meet
  through the weekly care plan in the middle.

### Two compliance moments (only the first is built)
1. **Plan-time** — planned vs authorized. Hard block at save. ✅ built.
2. **Delivery-time** — *actually delivered* care vs authorized ("did we stay
   within the funding?"). This is the `Delivered` figure on the Overview
   utilization meter and the future warn-with-override check on real shifts
   (Phase 3). **Delivered care should be measured from Electronic Visit
   Verification (EVV)** — real check-in/check-out at the point of care (GPS
   arrival/departure, mobile Phase 8) — *not* from scheduled shift durations.
   Until EVV lands, `Delivered` is an approximation derived from completed
   shifts and should be treated as provisional.

---

## MVP Scope — Home Care Agency Admin

### 1. Profile Management
- **Clients**: Create, Read, Update, Delete
- **Workers**: Create (via Supabase invite), Read (profile + shifts), Update, Delete

### 2. Scheduling
- **Shift Creation**: Single shift or multiple shifts bulk creation
- **Calendar Integration**: Auto-add to worker's Google Calendar via email

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
| Framework | React Native + Expo SDK 54 |
| Language | TypeScript (strict) |
| Routing | Expo Router v4 (file-based, `app/` dir) |
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

### Mobile Feature Roadmap

- [x] **Phase 0**: Project scaffold, design system, NativeWind, shared components, Expo Router setup
- [x] **Phase 1**: Authentication — sign in, JWT storage, Zustand auth store, protected routes
- [ ] **Phase 2**: Onboarding flow — pre-login 3-page intro, permissions screen, profile completion bar
- [ ] **Phase 3**: Invite acceptance — deep link handling, token verification, profile setup form, `POST /api/me/complete-profile` (requires EAS build)
- [x] **Phase 4**: Home screen — today's shifts summary, next shift card, warm empty state
- [ ] **Phase 5**: Schedule / shifts — calendar view, shift detail screen, ShiftCard component
- [ ] **Phase 6**: Profile overview — read own profile (`GET /api/me/profile`), credentials view
- [ ] **Phase 7**: Availability — weekly availability picker, `PATCH /api/me/availability`
- [ ] **Phase 8**: Visit verification — GPS check-in, distance check against client address
- [ ] **Phase 9**: Progress notes — note editor per shift occurrence, voice-to-text
- [ ] **Phase 10**: Digital flowsheet — per-client task checklist during shift
- [ ] **Phase 11**: Notifications — push notification setup, notification centre screen
- [ ] **Phase 12**: Compliance documents — upload docs to profile, view uploaded docs
- [ ] **Phase 13**: Leaderboard — attendance ranking among org workers
- [ ] **Phase 14**: Polish pass — animations, loading skeletons, empty states, error states, contextual nudges
- [ ] **Phase 15**: EAS Build setup, TestFlight beta, internal testers
- [ ] **Phase 16**: App Store submission (iOS) + Play Store submission (Android)

### Backend Endpoints Still Needed (Mobile)

| Endpoint | Phase | Purpose |
|---|---|---|
| `GET /api/me/profile` | 6 | Worker reads own profile |
| `PATCH /api/me/availability` | 7 | Worker updates own availability |
| `POST /api/me/shifts/{id}/check-in` | 8 | GPS check-in |
| `GET /api/me/notifications` | 11 | Notification history |
| `GET /api/leaderboard` | 13 | Org attendance ranking |

---

## Local Mobile Development Gotchas

### Running the Mobile App on a Physical Device

The phone needs two connections: Metro bundler (JS bundle) and the backend API. Both are tunnelled through ngrok/Expo so the setup is the same on any network.

**Every time you start a dev session:**

1. Start the backend: `docker compose up`
2. Run `ngrok http 8000`, copy the `https://xxxxx.ngrok-free.app` URL into `worker-mobile-app/.env.local` → `EXPO_PUBLIC_BACKEND_API_URL`
3. Run `cd worker-mobile-app && npx expo start --tunnel --clear`
4. Scan QR code in Expo Go.

**ngrok:** Microsoft Store install (v3.39.1), available in PATH as `ngrok`. Authtoken saved. Regenerate token at dashboard.ngrok.com if compromised.

### Expo Go vs Development Builds
- `expo-notifications` (starting SDK 53) will crash Expo Go immediately on import because native push capabilities were stripped from the Go app. It is currently commented out in `app/onboarding/permissions.tsx`. A custom development build must be created when we are ready to implement Push Notifications.
