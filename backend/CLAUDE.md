# CLAUDE.md — Homecare App Project Context

This file gives Claude full context on the homecare app project so every
conversation continues seamlessly without re-explaining decisions already made.

---

## What This App Is

An enterprise web + mobile application for Home Care Agencies to manage their
clients/patients and Home Support Workers. It replaces manual processes like
Excel sheets and physical files.

### Two Primary Stakeholders
- **Agency Admin (desktop web app)** — manages clients, workers, scheduling, compliance
- **Home Support Worker (mobile app)** — views shifts, documents visits, submits progress notes

---

## Monorepo Structure

```
homecare-app/
  backend/        ← FastAPI (Python) — being built first
  admin/          ← Admin desktop/web app (not started yet)
  mobile/         ← Home Support Worker mobile app (not started yet)
  shared/         ← Shared API contracts, constants, types
```

One `git init` at the root. No heavy tooling like Turborepo or Nx.

---

## Backend Stack

| Tool | Purpose |
|---|---|
| FastAPI | Python web framework |
| Supabase Auth | Authentication only (sign in, invite, JWT) |
| SQLAlchemy + psycopg2 | All data queries (direct Postgres connection) |
| Alembic | Database migrations |
| Pydantic | Request/response validation (schemas) |
| pydantic-settings | Environment variable management |

### Key Decision: Two Database Layers
- **Supabase client** → auth only (sign in, invite, JWT verification)
- **SQLAlchemy + psycopg2** → all data (clients, workers, shifts, visits, compliance)

This was chosen because the app has complex multi-table queries (scheduling,
compliance tracking, reporting) that SQLAlchemy handles more cleanly than the
Supabase HTTP client.

---

## Backend Folder Structure

```
backend/
  .venv/
  .env                          ← never committed
  .gitignore
  requirements.txt
  alembic.ini                   ← Alembic config
  alembic/                      ← Alembic migrations
    env.py
    versions/
  app/
    main.py                     ← App entry point. Imports models (noqa) so SQLAlchemy knows they exist.
    api/
      __init__.py
      api.py                    ← Registers all routers, prefix: /api
      routes/
        __init__.py
        auth.py
        clients.py
        visits.py
        workers.py
    core/
      __init__.py
      config.py                 ← Settings via pydantic-settings
      enums.py                  ← Shared enums (OrgMemberRole)
      security.py               ← get_current_user, require_admin, require_owner
    db/
      __init__.py
      session.py                ← SQLAlchemy engine + get_db dependency
      supabase.py               ← Supabase client (auth only)
    models/
      __init__.py
      base.py                   ← SQLAlchemy DeclarativeBase
      organization.py
      org_member.py             ← renamed from user.py
      client.py
      worker.py
      shift.py
    schemas/
      __init__.py
      auth.py                   ← Pydantic schemas for auth routes
    services/
      __init__.py
      auth_service.py
```

---

## Naming Decisions

- Table is called `org_members` not `users` — avoids confusion with Supabase's
  internal auth `users` table
- Model class is `OrgMember` not `User`
- Role enum is `OrgMemberRole` not `UserRole`
- Folder is `routes/` not `endpoints/`

---

## Roles / Authorization

Defined in `app/core/enums.py`:

```python
class OrgMemberRole(str, enum.Enum):
    owner = "owner"
    admin = "agency_admin"
    worker = "home_support_worker"
```

Three security guards in `app/core/security.py`:

```python
Depends(get_current_user)   # any signed in user
Depends(require_admin)      # owner or agency_admin
Depends(require_owner)      # owner only
```

---

## Auth Flow

1. **Register Organization** — creates owner in Supabase Auth + org record +
   org_member record. Uses Supabase service role key. No `get_db` needed.
2. **Invite User** — owner/admin sends invite email via Supabase. Role and
   org_id baked into the invite metadata.
3. **Sign In** — Supabase returns access_token + refresh_token. JWT contains
   first_name, last_name, role, org_id in user_metadata.
4. **Sign Out** — invalidates session via Supabase client.

### Route Convention
- Auth routes use **Supabase client only** → no `db: Session = Depends(get_db)`
- Data routes use **SQLAlchemy** → always include `db: Session = Depends(get_db)`

---

## API URL Structure

All routes go through `api.py` with prefix `/api`:

```
POST  /api/auth/register-organization
POST  /api/auth/invite
POST  /api/auth/sign-in
POST  /api/auth/sign-out
GET   /api/me                          ← protected route, any signed in user
GET   /api/clients
GET   /api/workers
GET   /api/visits
GET   /api/shifts
```

No versioning (`/api/v1`) — kept simple for now. Can be added later by
updating the prefix in `api.py`.

---

## Environment Variables

```
SUPABASE_URL=
SUPABASE_ANON_KEY=           ← safe for frontend
SUPABASE_SERVICE_ROLE_KEY=   ← backend only, never in frontend
DATABASE_URL=postgresql+psycopg2://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres
```

- Anon key → frontend apps (admin, mobile)
- Service role key → FastAPI backend only (bypasses RLS)

---

## Database / Migrations

Using **Alembic** for all schema changes. `create_all()` was removed from
`main.py` — Alembic owns schema management.

```bash
# Generate a migration after changing a model
alembic revision --autogenerate -m "description of change"

# Apply migrations
alembic upgrade head

# Roll back one migration
alembic downgrade -1
```

Every model must be imported in `migrations/env.py` for Alembic to detect it.

---

## Models Built So Far

### `Organization`
```
id, name, owner_id, is_active, created_at, updated_at
relationships: members, clients, workers
```

### `OrgMember`
```
id, first_name, last_name, email, role (OrgMemberRole), is_active,
created_at, updated_at, org_id (FK → organizations.id)
relationships: organization
```

### `Client` — in progress
### `Worker` — in progress
### `Shift` — in progress

---

## Services Built So Far

### `AuthService`
- `register_organization` — Supabase Auth + inserts into organizations +
  org_members tables
- `invite_user` — checks role, sends Supabase invite email with role + org_id
  in metadata
- `sign_in` — returns access_token, refresh_token, user metadata
- `sign_out` — calls Supabase sign out

---

## Key Principles to Always Follow

1. **Routes are thin** — no business logic, just call the service
2. **Services own the logic** — all Supabase and SQLAlchemy calls go here
3. **Auth routes** → Supabase client, no `get_db`
4. **Data routes** → SQLAlchemy, always `get_db`
5. **`main.py` only starts the app** — no DB logic, no model imports
6. **All models imported in `migrations/env.py`** — so Alembic can track them
7. **Never put service role key in frontend code**
8. **`except HTTPException: raise`** before broad `except Exception` catches

---

## Features Still to Build (in order)

1. Client profiles (CRUD)
2. Worker profiles (CRUD)
3. Shifts / Scheduling
4. Visits + Progress Notes
5. Flowsheets
6. Compliance Tracking
7. GPS arrival/departure
8. Voice to notes
9. Export reports
10. AI smart scheduling (suggest best worker for client)
11. Google Calendar integration

---

## Testing Approach

- **Now** — manual testing via FastAPI `/docs` and Thunder Client as each
  endpoint is built
- **Later** — Pytest automated tests once core features are stable, focusing
  on auth, scheduling, and compliance (anything touching patient data)
