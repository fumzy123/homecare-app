# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Architecture — Three-Layer Pattern (Complete)

The backend follows a strict three-layer architecture across all 8 service groups:

```
Router → Service → Repository → Database
```

- **Router** — HTTP only. Declares a factory function (`get_X_service`) that wires `db` and `current_user` via FastAPI `Depends`, then calls one service method and returns the result.
- **Service** — Business logic and transaction ownership. Class-based with `__init__(self, db, current_user)` that instantiates the repo and resolves shared context (e.g. `self.org_id`) once. Owns `db.commit()` and `db.rollback()`.
- **Repository** — Data access only. Takes `db: Session` in `__init__`. Named methods replace all raw `db.query()` calls. Never commits.

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

### Testing gap to be aware of

`OrgService.get_admin_org_id` is called directly inside the factory functions for the three mixed-auth services above. That means those factory functions make a real DB call before the service is even instantiated. In tests, you would need to override the whole factory function (not just `get_admin_org_id`) to avoid that query. Use FastAPI's `app.dependency_overrides` to swap the factory at the test level.

---

## What This App Is

A web application for Home Care Agencies to manage clients, Home Support Workers, scheduling, and compliance. The MVP targets Agency Admins on desktop; a Home Support Worker mobile app is post-MVP.

---

## Temporary: Email Confirmation Bypass (REMOVE AFTER DEMO)

Email confirmation is currently **bypassed** for the demo (added 2026-05-21). Registration goes directly to the dashboard with no email sent.

**What was changed — revert all of this after the demo:**

| File | Change |
|---|---|
| `backend/app/schemas/organization.py` | Added `RegisterDirectSchema` (email + password + org fields) |
| `backend/app/services/org_service.py` | Added `OrgService.register_organization_direct()` — uses Supabase admin `create_user` with `email_confirm: True` |
| `backend/app/api/routes/organization.py` | Added `POST /api/organization/register-direct` (public, no auth required) |
| `admin-frontend/src/features/auth/api.ts` | Added `authApi.registerDirect()` |
| `admin-frontend/src/features/auth/components/RegisterForm.tsx` | `onSubmit` calls `registerDirect` → `signInWithPassword` → dashboard. Removed the "check your email" UI state. |

The original email confirmation flow (`ConfirmEmailForm`, `resendConfirmationEmail`, `POST /api/organization`, etc.) is still fully intact — nothing was deleted.

---

## Monorepo Structure

```
homecare-app/
  backend/           ← FastAPI (Python) REST API
  admin-frontend/    ← React + TypeScript admin web app
  docker-compose.yml ← Local dev (runs both backend + DB)
```

No monorepo tooling (Turborepo/Nx). Each app manages its own dependencies independently.

> Note: `backend/CLAUDE.md` exists but reflects early MVP state; the current codebase is significantly further along.

---

## Commands

### Backend

```bash
# Run locally (with hot reload)
cd backend
uvicorn app.main:app --reload

# Run via Docker (recommended — also starts migrations)
docker compose up

# Install dependencies
pip install -r requirements.txt

# Lint
ruff check .

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
npm run typecheck    # tsc -b --noEmit (strict)
npm run lint         # ESLint
npm run preview      # Preview production build
```

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
| Frontend framework | React 19 + Vite + TypeScript |
| Routing | TanStack Router (file-based) |
| Server state | TanStack Query + Axios |
| Client state | Zustand (auth only) |
| Forms | TanStack Form + Zod |
| Styling | Tailwind CSS v4 (hand-rolled components, no shadcn) |

---

## Backend Architecture

### Layered structure: routes → services → repositories → database

```
app/
  main.py               ← App entry, registers middleware, mounts /api
  api/
    api.py              ← Aggregates all routers under /api prefix
    routes/             ← Thin HTTP handlers + factory functions (get_X_service)
  services/             ← Business logic. Class-based, __init__ resolves shared context.
  repositories/         ← Data access only. Named query methods. No commits.
  models/               ← SQLAlchemy ORM models
  schemas/              ← Pydantic request/response schemas
  core/
    config.py           ← pydantic-settings env config
    enums.py            ← OrgMemberRole and other enums
    security.py         ← get_current_user, require_admin, require_owner deps
  db/
    session.py          ← SQLAlchemy engine + get_db dependency
    supabase.py         ← Supabase client (auth only)
```

**Key invariants:**
- Auth routes use `supabase_client` only — no `db: Session`
- Data routes always use `db: Session = Depends(get_db)`
- Services own `db.commit()` and `db.rollback()` — repositories never commit
- `except AppError: raise` must appear before broad `except Exception` catches
- All models must be imported in `alembic/env.py` for autogenerate to detect them

### Two-layer database access

- **Supabase Auth client** → identity only (sign-in, invite, JWT verification)
- **SQLAlchemy + psycopg2** → all business data (multi-table queries, scheduling, compliance)

### Authorization

Three FastAPI dependency guards in `app/core/security.py`:
- `Depends(get_current_user)` — any signed-in user
- `Depends(require_admin)` — `owner` or `agency_admin`
- `Depends(require_owner)` — `owner` only

Roles are `OrgMemberRole` enum: `owner`, `agency_admin`, `home_support_worker`.

### Soft deletes

All deletable models have a `deleted_at` column. Queries always filter `deleted_at IS NULL`. No hard deletes — preserves audit trail.

### Naming conventions

- Table/model: `org_members` / `OrgMember` (not `users`) — avoids collision with Supabase's internal `auth.users`
- Folders: `routes/`, `services/`, `schemas/` (not `endpoints/`, `controllers/`, `serializers/`)

---

## Frontend Architecture

### File-based routing (TanStack Router)

```
src/routes/
  __root.tsx                  ← Root outlet
  index.tsx                   ← Landing page
  login.tsx / register.tsx    ← Public auth
  _protected.tsx              ← Auth guard + layout shell
    dashboard/
      index.tsx
      clients/$clientId/
      workers/$workerId/
      shifts/
      timesheet/
    settings/index.tsx
    upgrade.tsx               ← Payment gate
  accept-invite.tsx
```

`routeTree.gen.ts` is auto-generated by TanStack Router — never edit manually.

### Feature modules

```
src/features/
  auth/         api.ts + components/ + hooks/
  clients/      api.ts + components/ + hooks/
  shifts/       api.ts + components/ + hooks/ + utils/
  workers/      api.ts + components/
  billing/      api.ts + components/
  dashboard/    components/
```

Each feature owns its API calls (types + fetch), components, and hooks.

### Auth flow

1. Supabase session listener in `main.tsx` → writes to Zustand store
2. `_protected.tsx` `beforeLoad` checks auth token; redirects to login if absent
3. `isAdminRole()` in `shared/lib/roles.ts` blocks workers from accessing the admin app

### Data fetching

- Axios instance in `shared/lib/api-client.ts` — auto-refreshes JWT via Supabase on 401, retries request once
- TanStack Query wraps all server state

### Styling conventions

- Tailwind v4, custom design tokens: `cream`, `paper`, `ink`, `orange` colors
- Serif font for titles, sans-serif for body, mono for labels/codes
- No component library — all UI is hand-rolled Tailwind

---

## Environment Variables

### Backend (`.env.local` or `.env`)

```
SUPABASE_URL=
SUPABASE_KEY=               # Service role key — backend only, never frontend
DATABASE_URL=postgresql+psycopg2://...
FRONTEND_URL=http://localhost:5173
STRIPE_SECRET_KEY=
STRIPE_PRICE_ID=
STRIPE_WEBHOOK_SECRET=
BACKEND_SENTRY_DSN=         # Optional, production only
```

### Frontend (`.env.local`)

```
VITE_BACKEND_API_URL=http://127.0.0.1:8000
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=   # Anon key — safe for frontend
VITE_STRIPE_PUBLISHABLE_KEY=
VITE_SENTRY_DSN=                 # Optional
VITE_APP_ENV=development
```

---

## Testing

No automated tests yet. Current approach: manual via FastAPI `/docs` (Swagger UI). CI checks only: `ruff`, `pip-audit`, Python import check (backend); `tsc`, ESLint, Vite build (frontend).

---

## Scheduling — Current State (branch: feat/scheduling-improvements)

### Double-booking prevention (done — 2026-05-22)

`ShiftService` in `backend/app/services/shift_service.py` has four private helpers that enforce no worker can be scheduled in two places at once:

- `_shift_has_occurrence_on(shift, date)` — checks if an existing shift (single or recurring via RRULE) runs on a given date
- `_get_timeblock_for_shift_occurrence_on_date(shift, date, shift_mod_map)` — resolves the actual `(start, end)` for that occurrence, applying any `ShiftModification` overrides or skipping cancelled ones
- `_times_overlap(start_a, end_a, start_b, end_b)` — standard interval overlap: `start_a < end_b AND end_a > start_b`
- `_find_scheduling_conflicts(worker_id, proposed_time_blocks, exclude_shift_id)` — instance method, uses `self.shift_repo` and `self.org_id`, returns a list of conflict dicts with ISO datetime strings

Conflict checks are wired into `create_shift`, `edit_from_date`, `create_modification`, and `update_modification`. All raise **409 `WORKER_ALREADY_SCHEDULED_AT_THIS_TIME_BLOCK`**.

Frontend (`api-client.ts`) now throws `ApiError` (extends `Error` with `code` + `details`) instead of plain `Error`, so `CreateShiftDrawer` and `ShiftDetailDrawer` can detect the conflict code and format times in the user's local timezone via `toLocaleTimeString()`.

### Still to build on this branch

- Overtime prevention (max hours/week, approval by owner/manager)
- Push notification to workers when a new client is dispatched
