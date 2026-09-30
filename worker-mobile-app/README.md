# Running the worker app

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
