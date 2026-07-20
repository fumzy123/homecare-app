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
- [Node.js & npm](https://nodejs.org/)
- [Git](https://git-scm.com/)
- Supabase CLI (installed automatically via `npx` in the steps below)

### Step 1: Environment Variables
We use `.env.local` files for local development. These files are ignored by Git to keep secrets safe.
You need to create three `.env.local` files by copying the examples provided in each directory:

1. **Backend:** Copy `backend/.env.example` to `backend/.env.local`.
   *Make sure `SUPABASE_URL` and `DATABASE_URL` point to `host.docker.internal` instead of `127.0.0.1` so the Docker container can reach Supabase on your host machine.*
2. **Admin Frontend:** Copy `admin-frontend/.env.example` to `admin-frontend/.env.local`.
3. **Worker Mobile App:** Copy `worker-mobile-app/.env.example` to `worker-mobile-app/.env.local`. *(Note: Depending on how you test (Emulator vs Physical Device), you will need to update the URLs in this file. See the troubleshooting section in Step 5 for details).*

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
npx expo start --tunnel
```

#### Mobile App on Physical Devices (Network Issues)
If you are testing on a physical device and see a "Something went wrong" blue screen, or the app cannot reach the backend, it is likely due to your Wi-Fi blocking local connections. Choose one of these solutions:

**Option A: Use an Emulator/Simulator (Recommended)**
Bypass Wi-Fi entirely. Use `10.0.2.2` (Android Emulator) or `localhost` (iOS Simulator) in your `.env.local`.

**Option B: Android Physical Device via USB**
Connect your phone via USB with debugging enabled, then map your computer's ports directly to the phone. You can leave `.env.local` as `localhost`:
```bash
adb reverse tcp:8000 tcp:8000
adb reverse tcp:54321 tcp:54321
```

**Option C: Use localtunnel (For strict Wi-Fi networks) (Go with Option C. It's the quickest way)**
If you must test over Wi-Fi and it's blocking traffic, you can tunnel your services to the public internet:
1. Open two new terminals and run:
   - `npx localtunnel --port 8000`
   - `npx localtunnel --port 54321`
2. Update your `worker-mobile-app/.env.local` to use the two public `loca.lt` URLs generated above.
3. Start Expo with a tunnel: `npx expo start --tunnel --clear ` *(Note: If this crashes with a TypeError, wait 60 seconds and try again, as the free tunneling service has strict rate limits).*

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
