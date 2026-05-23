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

### Mobile App (`worker-mobile-app/.env`)

```
EXPO_PUBLIC_BACKEND_API_URL=http://10.0.0.117:8000   # Use local network IP for physical device
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
npx expo start --clear   # Starts Metro bundler and clears cache
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
