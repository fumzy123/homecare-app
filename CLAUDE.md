# CLAUDE.md — Homecare App

This file gives Claude full context so every conversation continues seamlessly.
Read this before touching any code.

---

## What This App Is

An enterprise web application for Home Care Agencies to manage clients/patients
and Home Support Workers. Replaces manual processes like Excel sheets and
physical binders.

### Two Primary Stakeholders
- **Agency Admin (desktop web app)** — manages workers, clients, scheduling,
  compliance, billing
- **Home Support Worker (mobile app)** — views shifts, documents visits,
  submits progress notes *(mobile not started yet)*

---

## Monorepo Structure

```
homecare-app/
  backend/          ← FastAPI (Python)
  admin-frontend/   ← React/TypeScript admin web app
  mobile/           ← HSW mobile app (not started)
```

One `git init` at the root. No Turborepo or Nx.

Run migrations: `cd backend && .venv\Scripts\alembic upgrade head`

---

## Backend Stack

| Tool | Purpose |
|---|---|
| FastAPI | Python web framework |
| Supabase Auth | Auth only — sign in, invite, JWT verification |
| SQLAlchemy + psycopg2 | All data queries (direct Postgres connection) |
| Alembic | Database migrations |
| Pydantic | Request/response validation |
| pydantic-settings | Environment variable management |

### Two Database Layers — intentional
- **Supabase client** → auth only (sign in, invite, JWT)
- **SQLAlchemy** → all data (complex multi-table queries, scheduling, compliance)

---

## Backend Structure

```
backend/app/
  api/
    api.py              ← registers all routers under /api prefix
    routes/
      org_members.py    ← all org member + worker CRUD
      clients.py
      shifts.py
      invitations.py
      organization.py
      leave.py          ← registered under /org-members prefix
      progress_notes.py ← registered under /shifts prefix
      billing.py
      legal.py
  core/
    enums.py            ← OrgMemberRole, EmploymentType
    security.py         ← get_current_user, require_admin, require_owner
    config.py
  db/
    session.py          ← SQLAlchemy engine + get_db
    supabase.py         ← Supabase client (auth only)
  models/
    __init__.py         ← MUST import every model so Alembic detects them
    org_member.py       ← flat — includes all staff + employment fields
    organization.py
    client.py
    shift.py / shift_modification.py
    invitation.py
    progress_note.py
    leave_record.py
  schemas/
    org_member.py       ← OrgMemberResponse, OrgMemberUpdateSchema, OrgMemberSelfUpdateSchema
    invitation.py       ← InvitationResponse (expires_at computed, not stored)
    organization.py
    client.py
    worker.py           ← WorkerProfileCreateSchema, WorkerProfileUpdateSchema (address/employment/availability)
    leave_record.py
    progress_note.py
  services/
    org_member_service.py   ← handles all org member operations
    org_service.py
    invitation_service.py
    client_service.py
    shift_service.py
    leave_service.py
    billing_service.py
```

---

## Critical Architecture Decision — Flat OrgMember Table

**There is no `worker_profiles` table.** It was dropped (migration `c1d2e3f4a5b6`).

All staff fields live directly on `org_members`:

```
Identity:    first_name, last_name, email, phone_number, gender, date_of_birth
Employment:  role, hire_date, is_active, employment_type, has_vehicle, max_hours_per_week
Address:     street, city, province, postal_code
Scheduling:  availability (JSONB)
Emergency:   emergency_contact_name, emergency_contact_phone, emergency_contact_relationship
Metadata:    org_id, created_at, updated_at, deleted_at
```

**Why:** Every org member (owner, admin, home support worker) is staff. The
separation served no purpose and forced a join on every query.

**There is no `/api/workers/` route.** All operations go through `/api/org-members/`.

---

## Roles & Authorization

```python
class OrgMemberRole(str, enum.Enum):
    owner                = "owner"
    agency_admin         = "agency_admin"
    home_support_worker  = "home_support_worker"
```

Three guards in `security.py`:
```python
Depends(get_current_user)   # any signed-in user
Depends(require_admin)      # owner or agency_admin
Depends(require_owner)      # owner only
```

---

## API Routes

```
POST   /api/auth/register-organization
POST   /api/auth/sign-in
POST   /api/auth/sign-out

GET    /api/org-members/                   ?role= filter (owner | agency_admin | home_support_worker)
GET    /api/org-members/{id}
POST   /api/org-members/                   accept invite → create member
PATCH  /api/org-members/{id}               admin updates any member in their org
PATCH  /api/org-members/{id}/self          member updates their own profile (syncs Supabase Auth)
DELETE /api/org-members/{id}               soft delete (sets deleted_at)
GET    /api/org-members/{id}/leave
POST   /api/org-members/{id}/leave
DELETE /api/org-members/{id}/leave/{leave_id}

GET    /api/clients/
POST   /api/clients/
GET    /api/clients/{id}
PATCH  /api/clients/{id}
DELETE /api/clients/{id}

GET    /api/shifts/
POST   /api/shifts/
GET    /api/shifts/{id}
PATCH  /api/shifts/{id}
DELETE /api/shifts/{id}
GET    /api/shifts/{id}/notes
POST   /api/shifts/{id}/notes

GET    /api/invitations/
POST   /api/invitations/
DELETE /api/invitations/{id}
POST   /api/invitations/{id}/resend

GET    /api/organization/

GET    /api/billing/status
POST   /api/billing/create-checkout-session
POST   /api/billing/portal-session

GET    /api/legal/{doc}
```

### PATCH /api/org-members/{id} vs /{id}/self

| | `PATCH /{id}` | `PATCH /{id}/self` |
|---|---|---|
| Guard | `require_admin` | `get_current_user` |
| Enforces | same org as caller | `current_user.id == member_id` |
| Fields | all OrgMemberUpdateSchema fields | 6 identity fields only |
| Supabase sync | No | Yes — JWT must stay fresh |

---

## Schemas

### `OrgMemberResponse` — returned for all member reads
All OrgMember fields including the flattened employment/address/availability columns.

### `OrgMemberUpdateSchema` — admin editing any member
All fields optional: name, phone, gender, DOB, hire_date, is_active,
employment_type, has_vehicle, max_hours_per_week, address fields,
availability, emergency contact fields.

### `OrgMemberSelfUpdateSchema` — self-edit only
first_name, last_name, email, phone_number, gender, date_of_birth.

### `InvitationResponse`
`expires_at` is **computed** (`invited_at + INVITE_EXPIRY_SECONDS`), not stored.
`INVITE_EXPIRY_SECONDS = 259_200` (72 hours) — must match Supabase Email OTP expiration.

---

## Frontend Stack

| Tool | Purpose |
|---|---|
| React + TypeScript | UI framework |
| Vite | Build tool |
| TanStack Router | File-based routing |
| TanStack Query | Server state / data fetching |
| TanStack Form | Form state management |
| Tailwind CSS | Styling |
| Lucide React | Icons |

---

## Frontend Structure

```
admin-frontend/src/
  features/
    auth/           api.ts, components/
    org-members/    api.ts          ← SINGLE source for all /api/org-members/* calls
    organization/   api.ts
    clients/        api.ts, components/
    workers/        components/     ← UI only, no api.ts (uses orgMembersApi)
    shifts/         api.ts, components/, utils/
    invitations/    api.ts, components/, constants.ts
    billing/        api.ts, components/
    leave/          api.ts
    dashboard/      components/
    account/        components/     ← ProfileForm, AgencySection, BillingSection, TeamSection
  routes/
    _protected/
      dashboard/
        workers/    index.tsx, $workerId.tsx, $workerId/index|edit|leave|attendance.tsx
        clients/
        shifts/
      account/      index.tsx       ← sticky sidebar + 4 section layout
  shared/
    components/
      layout/       Sidebar.tsx, Topbar.tsx
      ui/           Avatar, Btn, Card, DateInput, Kicker, StatusDot, Tag, ...
      AvailabilityGrid.tsx
    lib/            api-client.ts, phone.ts, shiftStatus.ts, date.ts
    stores/         auth.ts         ← Zustand auth store
```

### Critical Frontend Rule
**`features/workers/` has no `api.ts`.** All API calls for workers go through
`orgMembersApi` in `features/org-members/api.ts`. Workers are org members
filtered by `role=home_support_worker`.

```ts
// List workers
orgMembersApi.listByRole('home_support_worker')

// Get a single worker
orgMembersApi.getOrgMember(workerId)

// Admin updates a worker
orgMembersApi.updateOrgMember(workerId, payload)  // → PATCH /api/org-members/{id}

// Worker/admin updates their own profile
orgMembersApi.updateSelf(memberId, payload)        // → PATCH /api/org-members/{id}/self

// Delete a worker
orgMembersApi.deleteOrgMember(workerId)
```

---

## Invitation Flow

1. Admin sends invite → `POST /api/invitations/` → Supabase sends email
2. `expires_at` is computed from `invited_at + 259200s`, never stored in DB
3. Invited user clicks link → sets password → `POST /api/org-members/` with JWT metadata
4. Service reads `role` + `org_id` from JWT metadata, creates OrgMember row
5. Resend: `POST /api/invitations/{id}/resend` — deletes old Supabase user, re-invites
6. Frontend enforces 5-minute resend cooldown using `Set<string>` + `setTimeout`
7. Resend button only shown for **expired** invitations

---

## Auth Flow

1. **Register org** → Supabase Auth + org row + owner OrgMember row
2. **Sign in** → JWT contains `first_name`, `last_name`, `role`, `org_id` in `user_metadata`
3. **Self-update** → `update_self` syncs name/email back to Supabase so JWT stays fresh after refresh

---

## Key Principles

### Backend
1. **Routes are thin** — no business logic, just call the service
2. **Services own all logic** — Supabase and SQLAlchemy calls only in services
3. **Auth routes** → Supabase client only, no `get_db`
4. **Data routes** → SQLAlchemy, always `get_db`
5. **All models imported in `models/__init__.py`** — Alembic must see them
6. **Never put service role key in frontend**
7. **`except AppError: raise`** before broad `except Exception`
8. **Soft deletes** — set `deleted_at`, never hard delete org members or clients

### Frontend
1. **`orgMembersApi` is the only module for `/api/org-members/*`** — do not add worker API calls elsewhere
2. **No `worker_profile?.field`** — fields are flat on the worker object
3. **TanStack Query keys** — `['workers']` = `listByRole('home_support_worker')`, `['worker', id]` = single member
4. **`queryFn: workersApi.*` does not exist** — always use `orgMembersApi`

---

## Environment Variables

```
# backend/.env
SUPABASE_URL=
SUPABASE_KEY=               ← anon key (named SUPABASE_KEY in pydantic Settings)
SUPABASE_SERVICE_ROLE_KEY=  ← backend only, never in frontend
DATABASE_URL=postgresql+psycopg2://...

# admin-frontend/.env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_API_URL=
```

---

## Running Locally

```bash
# Backend
cd backend
.venv\Scripts\alembic upgrade head
uvicorn app.main:app --reload

# Frontend
cd admin-frontend
npm run dev
```

---

## MVP Status

### Done
- Auth (register org, sign in/out, invite flow with resend + expiry)
- Worker management (CRUD, availability grid, leave records)
- Client management (CRUD)
- Shift scheduling (calendar, create/edit/delete, recurrence, completion status)
- Progress notes
- Admin settings page (profile, agency info, billing, team & invitations)
- Billing integration (Stripe — subscription status, portal links)

### Post-MVP
- Home Support Worker mobile app
- Flowsheets
- Compliance tracking
- GPS arrival/departure
- Voice to notes
- Export reports
- AI Smart Scheduling
