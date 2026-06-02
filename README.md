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
3. **Worker Mobile App:** Copy `worker-mobile-app/.env.example` to `worker-mobile-app/.env.local`. *(Note: If testing the mobile app on a physical device, replace `127.0.0.1` with your computer's local Wi-Fi IP address).*

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
npx expo start --clear
```

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
