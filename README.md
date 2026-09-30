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

## 🚀 Local Development Setup

To ensure you don't pollute the Staging or Production databases, we run a completely isolated version of the app locally using Docker.

### Prerequisites
Before you start, make sure you have the following installed on your machine:
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Must be running)
- [Node.js & npm](https://nodejs.org/) (Node.js 22.13 or newer for the mobile app)
- [Git](https://git-scm.com/)
- Supabase CLI (installed automatically via `npx` in the steps below)

### Step 1: Environment Variables
We use `.env.local` files for local development. These files are ignored by Git to keep secrets safe.
You need to create three `.env.local` files by copying the examples provided in each directory:

1. **Backend:** Copy `backend/.env.example` to `backend/.env.local`.
   *Make sure `SUPABASE_URL` and `DATABASE_URL` point to `host.docker.internal` instead of `127.0.0.1` so the Docker container can reach Supabase on your host machine.*
2. **Admin Frontend:** Copy `admin-frontend/.env.example` to `admin-frontend/.env.local`.
3. **Worker Mobile App:** Copy `worker-mobile-app/.env.example` to `worker-mobile-app/.env.local` for local services. For hosted staging or production, create `.env.staging` or `.env.production` with that environment's backend URL, Supabase URL, and matching publishable key. The startup command selects the file; the Git branch does not. See the [mobile run guide](worker-mobile-app/README.md).

### Step 2: Start the Supabase Foundation
Start your isolated local database, authentication server, and storage buckets.

```bash
# In the root directory of the project
npx supabase start
```
*Note: This will output URLs for your Local Studio Dashboard (usually http://127.0.0.1:54323) where you can view your local database.*

### Step 3: Start the Backend
Our Python backend runs in a Docker container for seamless development.

```bash
# In the root directory of the project
docker compose up -d
```

### Step 4: Run Database Migrations
We use Alembic as our single source of truth for the database schema. You must apply the migrations to your empty local Supabase database.

```bash
cd backend
alembic upgrade head
```
*(If you do not have Python/Alembic installed locally, you can also run this inside the container: `docker compose exec backend alembic upgrade head`)*

### Step 5: Start the Frontends
Open two new terminals to run the frontends:

**Admin Dashboard:**
```bash
cd admin-frontend
npm install
npm run dev
```

**Mobile App:**
```bash
cd worker-mobile-app
npm install
npm run start:local -- --tunnel --go
```

Scan the QR code with Expo Go for SDK 57. The local setup requires both your
backend and local Supabase to be reachable from the phone.

**To test hosted staging instead**, configure `worker-mobile-app/.env.staging`,
then run this from `worker-mobile-app`:

```bash
npm run start:staging -- --tunnel --go
```

Hosted staging does not require local Docker services or backend/auth tunnels.
Use a worker account invited through the hosted staging website. Local, staging,
and production accounts are separate. `npm run start:production` explicitly selects
live production services. Stop the previous Expo process before switching, check
the environment and URLs printed at startup, and reload the project on your phone.

See the [mobile run guide](worker-mobile-app/README.md) for validation, environment
switching, sign-in troubleshooting, and EAS build configuration.

#### Mobile App on Physical Devices (Network Issues)
For local testing, the phone must reach the backend on port 8000 and Supabase on
port 54321. Expo's tunnel carries the app bundle; it does not tunnel either service.
Choose one of these connection methods:

**Option A: Use an Emulator/Simulator (Recommended)**
Bypass Wi-Fi entirely. Use `10.0.2.2` (Android Emulator) or `localhost` (iOS Simulator) in your `.env.local`.

**Option B: Android Physical Device via USB**
Connect your phone via USB with debugging enabled, then map your computer's ports directly to the phone. You can leave `.env.local` as `localhost`:
```bash
adb reverse tcp:8000 tcp:8000
adb reverse tcp:54321 tcp:54321
```

**Option C: Use service tunnels (For strict Wi-Fi networks)**
If you must test over Wi-Fi and it's blocking traffic, you can tunnel your services to the public internet:
1. Open two new terminals and run:
   - `npx localtunnel --port 8000`
   - `npx localtunnel --port 54321`
2. Update your `worker-mobile-app/.env.local` to use the two public `loca.lt` URLs generated above.
3. Set `EXPO_PUBLIC_BACKEND_API_URL` to the port 8000 tunnel and `EXPO_PUBLIC_SUPABASE_URL` to the port 54321 tunnel. Keep the publishable key from local Supabase.
4. Start Expo: `npm run start:local -- --tunnel --go`. Keep both service tunnels running while testing; update `.env.local` and restart the preview if their URLs change.

---

## 🛑 Shutting Down
When you are done working, cleanly shut down your environments to save system resources:

```bash
# 1. Stop the backend
docker compose down

# 2. Stop Supabase
npx supabase stop
```

## 📝 Database Migrations Workflow
If you need to change the database schema (e.g., add a table, change a column, or create a storage bucket):
1. **Never** make changes manually in the Supabase Cloud Dashboard.
2. Generate an Alembic migration in the `backend/` folder: `alembic revision -m "description_of_change"`
3. Write your SQLAlchemy operations or raw SQL in the generated file.
4. Run `alembic upgrade head` to apply it locally.
5. Commit the migration file. It will automatically be applied to Staging/Prod on the next deployment.
