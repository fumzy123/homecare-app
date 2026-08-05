# Homecare App

Welcome to the Homecare App repository! This document outlines the architecture and explains how to set up the local development environment for new developers.

## 🏗 Architecture

Our codebase is structured into three main isolated environments: Local, Staging, and Production. 
The repository consists of four main components:
- **`admin-frontend/`**: The web dashboard for agency admins (React + Vite).
- **`worker-mobile-app/`**: The mobile application for care workers (React Native + Expo).
- **`backend/`**: The API server handling business logic and database management (Python FastAPI + SQLAlchemy + Alembic).
- **`supabase/`**: The configuration for our local Supabase infrastructure (Postgres Database, Auth, Storage).

---

## 🚀 Local Development

Local development uses an isolated local Supabase instance so development does
not modify staging or production data. Run commands from the repository root
unless a step explicitly changes directories:

```powershell
cd C:\Users\<you>\path\to\homecare-app
```

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) must be running.
- [Node.js and npm](https://nodejs.org/) must be installed.
- Install Expo Go on a physical phone when testing the mobile app.
- Install and authenticate [ngrok](https://ngrok.com/) when using the physical-phone quick start.

The Supabase CLI is invoked through `npx`; a separate global installation is not
required.

### What runs locally

| Process | Purpose | Local address |
|---|---|---|
| Supabase API/Auth | Login, JWTs, storage, and data APIs | `http://127.0.0.1:54321` |
| PostgreSQL | Application database | `127.0.0.1:54322` |
| Supabase Studio | Local database/auth dashboard | `http://127.0.0.1:54323` |
| FastAPI | Homecare business API | `http://127.0.0.1:8000` |
| Vite | Admin web development server | `http://localhost:5173` |
| Metro | Bundles mobile JavaScript and sends it to Expo Go | address shown by Expo |

`127.0.0.1` and `localhost` always mean "this device." On a physical phone they
refer to the phone, not the development computer. That is why the physical-phone
flow below exposes FastAPI and local Supabase through temporary HTTPS tunnels.

### One-time environment setup

Create the ignored local environment files if they do not already exist:

```powershell
Copy-Item backend\.env.example backend\.env.local
Copy-Item admin-frontend\.env.example admin-frontend\.env.local
Copy-Item worker-mobile-app\.env.example worker-mobile-app\.env.local
```

After `npx supabase start`, run `npx supabase status` to see the local anon key
and service-role key. Configure `backend/.env.local` for a backend running inside
Docker:

```env
SUPABASE_URL=http://host.docker.internal:54321
SUPABASE_SECRET_KEY=<local service_role key>
DATABASE_URL=postgresql+psycopg2://postgres:postgres@host.docker.internal:54322/postgres
FRONTEND_URL=http://localhost:5173
```

`host.docker.internal` lets the backend container reach Supabase ports exposed on
the Windows/macOS host. Never put the service-role key in either frontend.

Configure `admin-frontend/.env.local` with the local Supabase anon/publishable key:

```env
VITE_BACKEND_API_URL=http://127.0.0.1:8000
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_PUBLISHABLE_KEY=<local anon key>
```

The mobile URLs depend on whether the app runs on an emulator, over USB, or on a
physical phone. The physical-phone quick start below sets them after its tunnels
are created.

## Quick start: backend + admin web

Use this path to run the desktop admin application.

### 1. Start local Supabase

From the repository root:

```powershell
npx supabase start
npx supabase status
```

`supabase start` starts local Docker containers for PostgreSQL, Auth, Storage,
and Studio. It returns to the prompt after the containers are running.

### 2. Start FastAPI

In a second terminal, from the repository root:

```powershell
docker compose up --build
```

Keep this terminal running. Verify FastAPI at <http://localhost:8000/docs>.

### 3. Apply database migrations

In a third terminal, from the repository root:

```powershell
docker compose exec backend alembic upgrade head
```

Local Compose deliberately starts Uvicorn directly for hot reload and does not
run `backend/entrypoint.sh`. Therefore local migrations are explicit. Alembic
checks `alembic_version` and only applies migrations the database is missing, so
this command is safe when the database is already current.

### 4. Start the admin web app

In another terminal:

```powershell
cd admin-frontend
npm install
npm run dev
```

Open <http://localhost:5173>. `npm install` is normally only required after a
fresh clone or when dependencies change.

## Quick start: backend + mobile on a physical phone

First complete steps 1-3 from the admin quick start so local Supabase, FastAPI,
and the database schema are ready. Then use the following terminals.

### 4. Expose FastAPI to the phone

```powershell
ngrok http 8000
```

Keep ngrok running and copy its current HTTPS forwarding URL, for example
`https://example.ngrok-free.app`.

### 5. Expose local Supabase Auth/API to the phone

From the repository root in another terminal:

```powershell
npx localtunnel --port 54321
```

Keep LocalTunnel running and copy its current `https://...loca.lt` URL. This
tunnel is separate from the FastAPI tunnel because Supabase and FastAPI listen
on different ports.

### 6. Update the mobile environment

Set `worker-mobile-app/.env.local` using the two current tunnel URLs and the
local Supabase anon key from `npx supabase status`:

```env
EXPO_PUBLIC_BACKEND_API_URL=https://<current-backend>.ngrok-free.app
EXPO_PUBLIC_SUPABASE_URL=https://<current-supabase>.loca.lt
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<local anon key>
```

Do not append `/api` to `EXPO_PUBLIC_BACKEND_API_URL`; the mobile API client adds
it. Tunnel URLs are temporary and normally change when restarted. Old URLs cause
`Network request failed` or `503 Tunnel Unavailable` errors.

### 7. Start Metro and Expo Go

With the phone and computer on the same Wi-Fi:

```powershell
cd worker-mobile-app
npm install
npx expo start --lan --clear
```

Scan the QR code with Expo Go. Metro runs on the computer, builds the JavaScript
bundle, sends it to Expo Go, and pushes updates as files change. `--clear`
rebuilds Metro's cache, so the first bundle may take longer.

If the phone cannot reach Metro over the LAN, retry with:

```powershell
npx expo start --tunnel --clear
```

Expo's tunnel only exposes Metro; it does not expose FastAPI or Supabase. Expo
tunnels can occasionally time out, so prefer `--lan` when both devices are on the
same Wi-Fi.

### Mobile alternatives

- **Android emulator:** use `http://10.0.2.2:8000` for FastAPI and
  `http://10.0.2.2:54321` for Supabase.
- **iOS simulator:** use `http://localhost:8000` and
  `http://localhost:54321`.
- **Android over USB:** run `adb reverse tcp:8000 tcp:8000` and
  `adb reverse tcp:54321 tcp:54321`, then use `localhost` URLs on the phone.

After changing any `EXPO_PUBLIC_*` value, stop Metro with Ctrl+C and restart it;
Expo reads `.env.local` when Metro starts.

### Troubleshooting

- **`x-localtunnel-status: Tunnel Unavailable`:** restart the affected tunnel,
  copy its new URL into `worker-mobile-app/.env.local`, and restart Metro.
- **Backend Docker build cannot read `.pytest_cache`:** test/tool caches are
  excluded by `backend/.dockerignore`; rebuild the image.
- **Backend reports missing tables or columns:** run
  `docker compose exec backend alembic upgrade head`.
- **Authentication immediately retries an old session:** Expo SecureStore may
  contain an earlier local Supabase session. Clear the Expo Go project/app data
  and sign in again after confirming the URL and anon key.
- **Check local services:** use `npx supabase status`, open Supabase Studio at
  <http://127.0.0.1:54323>, and open FastAPI docs at
  <http://localhost:8000/docs>.

## 🛑 Shutting down

Stop Metro, ngrok, LocalTunnel, and foreground Compose processes with Ctrl+C.
Then, from the repository root:

```powershell
docker compose down
npx supabase stop
```

## 📝 Database Migrations Workflow
If you need to change the database schema (e.g., add a table, change a column, or create a storage bucket):
1. **Never** make changes manually in the Supabase Cloud Dashboard.
2. Generate an Alembic migration in the `backend/` folder: `alembic revision -m "description_of_change"`
3. Write your SQLAlchemy operations or raw SQL in the generated file.
4. Run `alembic upgrade head` to apply it locally.
5. Commit the migration file on a feature branch and merge it through the normal
   review flow. Deployed backend images run `backend/entrypoint.sh`, which applies
   `alembic upgrade head` before Uvicorn starts unless the hosting platform
   overrides the Docker entrypoint.
