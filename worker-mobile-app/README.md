# Running the worker app

## Home screen

The Home route only supplies the page shell. `features/home/components/WorkerHome`
orchestrates feature hooks and presentation-only cards. Pull-to-refresh updates
visits, notes, profile, credentials, notifications, and stats together.

- Weekly completed hours are **provisional scheduled durations of completed visits**,
  not verified attendance or payroll. Home uses the backend's Sunday–Saturday week.
- Punctuality stays unavailable until the backend supplies recorded attendance.
  A visit whose scheduled time has begun is labelled **Scheduled now**, never checked in.
- Workers can read and append progress-note entries for their own assigned occurrences
  through `/api/me/shifts/{shift_id}/notes`. Existing entries are preserved; concurrent
  changes require review. Note reminders cover completed visits in the last seven days.
- Notes require the matching backend changes to be deployed. Load/save failures retain
  unsaved editor text, and missing reminder data is not shown as an empty list.
- Agency contact is omitted until an agency contact channel is available in the data;
  the footer opens the worker's complete schedule.

Validation: `npm run typecheck` and
`node --test scripts/home-shifts.test.cjs scripts/environment.test.cjs`.

Use Node.js 22.13 or newer. Run these commands from `worker-mobile-app`:

On a new checkout, run `npm ci` first. Install Expo Go compatible with SDK 57 on
your phone. No TestFlight or store release is required for this preview.

| Command | Settings file | App label |
| --- | --- | --- |
| `npm run start:local` | `.env.local` | HomeCare Worker App (Dev) |
| `npm run start:staging` | `.env.staging` | HomeCare Worker App (Staging) |
| `npm run start:production` | `.env.production` | HomeCare Worker App |

`npm start`, `npm run android`, `npm run ios`, and `npm run web` default to local.
To open hosted staging in Expo Go on a phone:

```sh
npm run start:staging -- --tunnel --go
```

Stop the previous Expo process before changing environments. The launcher clears
Metro's cache. Reload the project in Expo Go and sign in with an account from the
selected environment. Git branches do not select accounts or service connections.
Setting `APP_ENV` alone also does not select a settings file. Use these commands
instead of invoking `npx expo start` directly.

## Phone quick starts

**Hosted staging:** create `.env.staging` using `.env.example` as a template, fill
in the hosted staging service URLs and its Supabase publishable key, then run:

```sh
npm run start:staging -- --check
npm run start:staging -- --tunnel --go
```

Check that startup prints `Mobile environment: staging` and the hosted service
addresses. Scan the QR code, accept a worker invitation from the staging website,
set up the worker's password on the web, and use those credentials in the mobile
app. An agency-admin account does not provide worker access. Local Docker services
and local backend/auth tunnels are not needed for hosted staging.

**Local:** start local Supabase and the backend using the [repository setup guide](../README.md).
Make both services reachable from your phone, using your network, USB forwarding,
or separate service tunnels. Configure `.env.local` with those addresses and the
local Supabase public key, then run:

```sh
npm run start:local -- --tunnel --go
```

The Expo tunnel serves the JavaScript bundle only. It does not expose the backend
or Supabase. Local test emails are captured by the mail UI at
`http://127.0.0.1:54324` on your computer unless local SMTP is configured otherwise.

**Production:** `npm run start:production -- --tunnel --go` reads `.env.production`
and connects to live accounts and data. It does not deploy or publish the app.

## Connection settings

Each file must contain `EXPO_PUBLIC_BACKEND_API_URL`, `EXPO_PUBLIC_SUPABASE_URL`,
and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for the same environment. Optionally set
`EXPO_PUBLIC_FRONTEND_URL` for links back to the agency website. Start with
`.env.example` when setting up a new machine. Use only publishable or legacy anon
keys; never put backend secrets or service-role keys in the mobile app.

The launcher reads exactly the selected file without modifying it, removes
inherited `EXPO_PUBLIC_*` values, and disables Expo's automatic dotenv loading.
It validates required values and URL formats, prints service URLs, and hides keys.
Validation cannot prove that an opaque publishable key belongs to the selected
Supabase project; use the key supplied by that project's settings.

Check configuration without starting a server:

```sh
npm run start:staging -- --check
npm run test:env
```

## Troubleshooting sign-in

- **Wrong accounts or data:** check the environment and both service URLs printed
  by the launcher. Switching branches or changing the app label does not switch accounts.
- **Missing settings:** the launcher stops and names the missing variable. Fill
  it in the selected file; it will not borrow values from another environment.
- **Network errors in local mode:** check both service tunnels or local connections.
  A working Expo QR code does not prove the API or sign-in service is reachable.
- **Sign-in succeeds but worker access fails:** confirm the invitation was accepted,
  the account is an active worker, and the selected backend includes `/api/me/account`.
  A 404 on that route requires the compatible backend deployment, not a new password.
- **Expo Go version mismatch:** use Expo Go compatible with the project's SDK 57.

When finished, press Ctrl+C in the Expo terminal and stop any local tunnels you started.

## My Profile

The Me tab composes `features/profile/components/WorkerMe`. Personal details open
from **View profile** beneath the worker's identity. Employment is read-only;
documents, care preferences and emergency contact live under **Ready for care**.
Notification preferences and time-off requests are not part of this screen.

Availability is Sunday-first, with separate hours and optional multiple windows
per day. Saving replaces the worker's whole availability through
`PATCH /api/me/availability`; it does not change existing visits. Deploy the
matching backend with this app version. The profile API also supplies the agency
name. No database migration is needed. Workers cannot edit their employment type,
status, pay or weekly cap through the self-service profile endpoint.

Credential status uses agency verification, with a 30-day renewal window.
Replacement uploads require verification again. Agency phone numbers are not
stored yet, so the coordinator dialog directs workers to their onboarding contact
information instead of providing a call action.

Run `npm run typecheck` and `npm run test:profile` for profile checks. Backend
coverage lives in `tests/services/test_worker_profile.py`. Android/iOS bundle
exports check compilation; device testing is still required for keyboards, file
picking, document viewing, offline saving and navigation with a worker account.

## EAS builds and updates

EAS uses server-managed environment variables, not this local startup launcher.
`eas.json` explicitly maps development builds to the EAS `development` environment,
preview builds to `preview` (our staging services), and production to `production`.
Automatic dotenv loading is disabled for those builds so a local file cannot
override their service connections.

Before building, configure the three required connection variables and optional
frontend URL in each matching EAS environment. Use device-reachable services for
development builds. These remote values are not provisioned by the local scripts.
Keep `APP_ENV` consistent with the build profile. If EAS Update is enabled later,
select the matching EAS environment explicitly with `--environment` when publishing;
the local start commands do not publish updates or deploy anything.

## Android staging push development

Use the `development-staging` EAS profile. It inherits staging services from
`preview`, uses `com.homecareapp.worker.staging`, and includes `expo-dev-client`.
The staging Firebase app configuration is `google-services.staging.json`.
The private FCM service-account key stays in EAS credentials, never in the app.

### Keeping Firebase configuration outside Git

The staging configuration file is ignored by Git. A local copy can live at
`worker-mobile-app/google-services.staging.json`; do not force-add it.
Download a replacement from Firebase project settings → General → Your apps →
the staging Android app (`com.homecareapp.worker.staging`) → google-services.json.
This file is client configuration, distinct from the private service-account JSON.

For cloud builds, upload it as an EAS **file** environment variable named
`GOOGLE_SERVICES_JSON`, with secret visibility, in the **preview** environment
(used by preview and development-staging builds). `app.config.js` uses the file
path supplied by EAS, falling back to the ignored local staging file. Use the
production Firebase file in the production environment; never reuse staging there.
Secret visibility keeps the uploaded file out of Git and ordinary dashboard output;
its client configuration is still incorporated in the built Android app.
This code change does not upload the file or provision EAS credentials for you.

Backend delivery setup and remaining phone tests are in `../backend/WORKER_PUSH.md`.

### Testing the installed staging app

Install the APK supplied by EAS, then start Metro with:

```powershell
npm run start:staging:dev -- --tunnel
```

Open **HomeCare Worker App (Staging)** on the phone and connect to that server.
Sign in, finish the introduction, then go to **Settings → Phone notifications →
Enable notifications**. A granted Android permission alone is not registration:
the status confirms registration only after the backend saves the token.
Expo Go remains usable for ordinary testing but cannot register for Android push.

Deploy the backend and Alembic revision `0ab31e782c90` before phone registration.
The authenticated registration endpoint derives the worker from the signed-in
account. The installation proof is kept in SecureStore; the backend stores its
hash. The revoke endpoint accepts only this device's proof, returns no records,
and works after session expiry. Registrations are serialized with logout cleanup;
failed logout cleanup keeps the account signed in and asks for a network retry.
Sign-out is local to this device. Foreground refresh retries registration and
cleans up registrations after account changes or revoked OS permissions.

This is the registration foundation, not scheduling-event delivery. The backend
still needs delivery jobs, retries/receipts, invalid-token cleanup, and safe
occurrence-specific notification destinations. Taps currently open the inbox.
Any sender must recheck active employment/agency access, select the correct app
environment, and keep client/care information out of lock-screen messages.

Checks: `npm run typecheck`, `npm run test:push`, and backend
`python -m pytest tests/services/test_push_device.py`. Physical-phone delivery,
background/closed-app taps, permissions, account switching and sign-out require
device testing before release. No production Firebase configuration is added.

## Password recovery and MVP onboarding

The sign-in screen's **Forgot password?** link opens `/forgot-password` on
`EXPO_PUBLIC_FRONTEND_URL`. Use the website for the same auth environment as the
app. The worker requests the reset email and sets a password on the web, then
returns to mobile sign-in. No password or email is put in the browser URL.

Set this public website URL in `.env.local`, `.env.staging` or `.env.production`
for local previews, and separately in the matching EAS environment for cloud
builds. Restart Metro after changing an environment file. A missing URL shows
an error; it never falls back to another environment.

Retired `/onboarding/*` routes redirect to the existing session-aware entry point.
The current worker welcome/skip/three-step introduction is unchanged. The MVP no
longer includes the location package, permission prompt or GPS/flowsheet promises.
A new native build is needed to apply permission changes; Expo Go has its own
permissions. Directions still open the phone's maps app with the visit address.

Run `npm run test:website-links` for recovery/privacy link handling checks.
End-to-end email recovery and first/returning-login testing on Android remain on
the release checklist.

## Settings and legal documents

Open **Me → Settings** for phone notification status/permission controls, Privacy
Policy, Terms of Service, the agency DPA, password recovery and introduction
replay. Notification controls open the phone's app settings when permission is
blocked or the device is registered; there is no inbox shortcut in Settings.
Expo Go explains why phone push controls require an installed Android build.

Privacy and Terms are also available before sign-in. All legal links open the
matching website selected by `EXPO_PUBLIC_FRONTEND_URL`. Local webpage edits do
not change the hosted staging documents until the website is deployed.

See [PRIVACY_REVIEW.md](PRIVACY_REVIEW.md) for the draft document review, unresolved
business details, agency/worker acceptance distinction and account-deletion gap.
