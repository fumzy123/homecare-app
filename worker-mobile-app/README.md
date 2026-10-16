# Running the worker app

## Environments, builds and where code runs

The service environments are **local**, **staging** and **production**.
`APP_ENV` uses those same three values. Local means the backend and Supabase
run on your computer; staging and production use their separate hosted services.
The startup command selects the matching `.env` file and supplies its service
addresses. An EAS settings group does not create another backend environment.

On a physical phone, both the native application and its JavaScript execute on
the phone. Metro runs on your computer and prepares/serves changing JavaScript
for Expo Go and development builds. Standalone builds include their JavaScript;
they run without Metro, but still need their backend/auth services for online work.
Saving a source file does not update an installed standalone app. EAS Update is
not configured in this project.

The four existing EAS build-profile names are retained:

| Profile | Build type | APP_ENV | EAS settings group | Installed Android identity |
| --- | --- | --- | --- | --- |
| `development` | Development client | `local` | `development` | `com.homecareapp.worker.dev` |
| `development-staging` | Development client | `staging` | `preview` | `com.homecareapp.worker.staging` |
| `preview` | Standalone internal APK | `staging` | `preview` | `com.homecareapp.worker.staging` |
| `production` | Standalone store bundle | `production` | `production` | `com.homecareapp.worker` |

`development-staging` inherits `preview` and enables `developmentClient`.
The two staging profiles share an Android identity, so they are alternative
installations, not separate side-by-side apps. Expo Go is a separate application,
not one of these build profiles. Development clients support native push testing;
Expo Go does not support this app's Android remote push registration.

`NODE_ENV=development` and `developmentClient: true` describe developer tooling,
not a fourth service environment. The local variant keeps the **Care Harbor (Dev)**
label and `.dev` Android/iOS identifier. The naming change does not alter installed
identities, signing credentials or the EAS project. Direct invocations that used
`APP_ENV=development` must now use `APP_ENV=local`; invalid values fail explicitly
instead of silently selecting the production identity.

### Choose the app and command together

Run startup commands on your computer from this folder. They start Metro; they
do not create an APK, deploy a backend, publish an update or release to a store.

| Workflow | Open on the phone | Computer command |
| --- | --- | --- |
| Local screens/workflows | Expo Go | `npm run start:local -- --tunnel --go` |
| Staging screens/workflows | Expo Go | `npm run start:staging -- --tunnel --go` |
| Local native development | App built with `development` | `npm run start:local -- --tunnel --dev-client` |
| Staging native development/push | App built with `development-staging` | `npm run start:staging:dev -- --tunnel` |
| Standalone staging testing | App built with `preview` | No Metro command |
| Production use | Store-distributed production app | No Metro command |

For a development app, scan the Metro QR link or select its server in the app's
launcher. The startup command supplies JavaScript service settings; it cannot
change the installed native package or Firebase configuration. Pair the app and
command as above. Compatible JavaScript edits refresh without reinstalling;
native libraries, permissions or Firebase configuration changes require a rebuild.

To create a new Android package, select the profile explicitly, for example
`eas build --platform android --profile development-staging` or
`eas build --platform android --profile preview`. EAS builds on cloud computers;
the resulting installed app executes on the phone. Building is separate from
Google Play submission and release.

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
| `npm run start:local` | `.env.local` | Care Harbor (Dev) |
| `npm run start:staging` | `.env.staging` | Care Harbor (Staging) |
| `npm run start:production` | `.env.production` | Care Harbor |

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
`eas.json` maps `development` to the EAS `development` settings group with
`APP_ENV=local`; `development-staging` and `preview` both use the `preview`
settings group with `APP_ENV=staging`; production uses `production`.
Automatic dotenv loading is disabled for those builds so a local file cannot
override their service connections.

Before building, configure the three required connection variables and optional
frontend URL in each matching EAS environment. Use device-reachable services for
development builds. These remote values are not provisioned by the local scripts.
Keep `APP_ENV` consistent with the build profile. If EAS Update is enabled later,
select the matching EAS environment explicitly with `--environment` when publishing;
the local start commands do not publish updates or deploy anything.

### Initial read-only cloud configuration check — 2026-10-15

This records the initial audit. Production provisioning completed afterward;
see the production setup update below for the current state.

Inspected the existing Expo project `@fumzy123/worker-mobile-app`
(`124a574b-172d-4691-b959-b54a474f78ae`) through authenticated EAS queries.
Both project-level and account-level variables were checked. Public connection
settings and publishable keys were compared in memory with the matching local
files; key values were not printed. No cloud settings or credentials were changed.

| Settings group | Verified state |
| --- | --- |
| `development` (local app variant) | No project/account variables. Local startup still reads `.env.local`; this is not a fourth hosted environment. Do not assume cloud settings provide local service URLs. |
| `preview` (staging) | Backend, Supabase URL, publishable key and website match `.env.staging`. `GOOGLE_SERVICES_JSON` exists as a secret file variable. No account-level overrides. |
| `production` | Backend, Supabase URL and publishable key match `.env.production`. The website is supplied by the production profile as `https://www.careharbor.online`, matching the local file; it is not a cloud variable. No `GOOGLE_SERVICES_JSON` or account-level overrides. |

EAS Android credential metadata contains the staging package only:
`com.homecareapp.worker.staging`, with an FCM v1 credential for Firebase project
`homecare-staging-2026` and a signing credential. No production or local package
credential entry was returned. The staging secret file's contents cannot be read
back through this audit; its matching package/project and the successful signed
preview build are recorded in the separate
[staging Android acceptance preparation](../docs/staging-android-acceptance-2026-10-15.md).
Credential presence does not prove that a key is valid or a phone receives pushes.

Production push therefore still needs its Firebase client file in the production
EAS settings group and a matching FCM credential assignment for
`com.homecareapp.worker`.

The official Firebase plugin audit subsequently succeeded after the user completed
plugin sign-in. Its project listing returned only **HomeCare Staging**
(`homecare-staging-2026`), with ACTIVE state. Listing all registered apps returned
one ACTIVE Android app, **HomeCare Worker Staging**, with package
`com.homecareapp.worker.staging` and Firebase app ID
`1:118822022614:android:3273f37b7302f4c9bec877`. The Firebase SDK configuration's
project ID, project number, app ID and package match the ignored local
`google-services.staging.json`. Together with the EAS credential metadata above,
this verifies consistent staging identities; it does not prove device delivery.

The prior Firebase browser access error is superseded by these successful plugin
reads. No production Firebase project is listed for the signed-in account, and
there is no production Android app in the staging project. Projects inaccessible
to this account cannot be ruled out. Confirm the intended production ownership
before creating a project; never reuse staging configuration for production.
Production Firebase/EAS setup, signing/store setup and phone acceptance remain
outstanding. This audit created no projects or apps and changed no cloud settings;
it selected staging as the plugin's active project for the read-only inspection.

After configuration, build and install the matching app and complete the real
device checks in [GOOGLE_PLAY_RELEASE.md](GOOGLE_PLAY_RELEASE.md): foreground,
background and closed-app delivery/taps, denied permissions and account changes.
The automated environment, push and website-link tests and TypeScript check pass
for this naming change; no phone-delivery or production-release sign-off is implied.

### Production setup update — 2026-10-15

After authorization to prepare the release, created Firebase project
`homecare-production-2026` (Care Harbor Production), project number `605449165161`,
under the same signed-in Google account as staging. Registered Android package
`com.homecareapp.worker`, Firebase app ID
`1:605449165161:android:2c0efe30a977993d2c85f8`.

- Uploaded its Android client configuration to the EAS **production** secret file
  variable `GOOGLE_SERVICES_JSON`. The temporary local file is under ignored `.expo/`.
- Created the dedicated `expo-push@homecare-production-2026.iam.gserviceaccount.com`
  service account with `roles/firebasecloudmessaging.admin` on production only.
  FCM API is enabled. Uploaded its key to EAS and assigned it to the production
  Android package; removed the temporary private key file after upload.
- Verified EAS now has separate staging and production FCM project assignments.
  The staging assignment was not changed. No paid billing plan was enabled.
- EAS generated a production Android signing keystore and completed store build
  [5da88354-64a3-4670-a323-dad1e0b4139a](https://expo.dev/accounts/fumzy123/projects/worker-mobile-app/builds/5da88354-64a3-4670-a323-dad1e0b4139a),
  version 1.0.0 / versionCode 2. The downloaded AAB passes Google's bundletool
  validation and contains the production package, Firebase app/project, target
  API 36 and no location permissions. See the release worksheet for remaining gates.
- Production backend is healthy with one replica. All 21 mobile API routes
  extracted from feature API wrappers are present in its OpenAPI specification.
  This checks route availability, not authenticated workflow correctness.
- Production Railway has no push delivery settings; defaults keep delivery off.
  Enable the production app allow-list and delivery only after staging acceptance
  and production test readiness. A Firebase key alone does not enable backend sending.

The source archive contained only the mobile project, with no environment files,
service-account keys, private signing files or backend/admin source. Cloud builds
use EAS settings, not the local `.env.production` file. Device acceptance, final
business/privacy information and Play account access still gate release.

## Android staging push development

Use the `development-staging` EAS profile. It inherits the build configuration
from `preview`, uses `com.homecareapp.worker.staging`, and includes `expo-dev-client`.
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

Open the **Care Harbor (Staging)** development app on the phone and connect to that server.
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

Scheduling-event delivery is implemented: the backend queues notices with the
scheduling transaction, dispatches through Expo, retries transient failures,
checks receipts and retires invalid tokens. Taps open the authenticated inbox;
schedule notices lead to the schedule. Delivery checks current worker/device
ownership and the allowed app identity, and omits patient details from payloads.
Apply migration `de9e97b23461` and configure the matching credentials and backend
delivery settings before using it. See [worker push rollout](../backend/WORKER_PUSH.md).
Implementation is not proof of deployment or physical-phone delivery.

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
