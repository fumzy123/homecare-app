# Android first-release preparation

Prepared 2026-10-02. This document is a release worksheet, not evidence of submission.

## Release scope

Scope updated from the user's MVP decisions on 2026-10-02. The source of truth
for feature scope is the Worker Android MVP section in `../AGENTS.md`.

Ship the working agency worker experience: sign-in after a web agency invitation,
Home, scheduled visits, assigned clients and care information, progress notes,
profile and credential uploads, the in-app notification inbox, and basic worker
push notifications. Registration, transactional delivery and inbox tap handling are
implemented; deployment, Android credentials and physical-device delivery still
need verification. See `../backend/WORKER_PUSH.md` for rollout and retry behavior.

Do not advertise verified attendance, GPS check-in/out, payroll, voice notes,
flowsheets, offline saving, or attendance rankings in this release. Advertise
push delivery only after implementation and device verification pass.
Completed-hour totals are provisional scheduled durations, not verified worked hours.

## MVP work checklist — focus order

- [ ] Implement push registration, Android credentials, server delivery and tap
      navigation for new assignments and schedule changes/cancellations. Handle
      account changes, denied permissions and invalid tokens. No patient details
      in lock-screen text. Verify foreground, background and closed-app behavior.
- [ ] Retain the existing welcome/skip flow and web invitation setup. Test first
      login, returning users and pending/expired/no-access accounts. Add the push
      permission prompt and remove/redirect legacy onboarding screens that show
      sample completion data or promise deferred features.
- [ ] Remove unused location permission declarations and requests. Keep completed
      hours labelled as estimates; do not present punctuality as operational.
- [ ] Configure production connections and website URL; make password recovery
      accessible before sign-in and test the recovery and privacy links.
- [ ] Run the device acceptance checks below on a signed Android release and fix
      failures. Prioritize reliable core workflows over cosmetic enhancements.
- [ ] Complete the store/account/privacy checklist and send the release for review.

Account setup, privacy details and store assets can progress while push is built.
The completed MVP is the verified core workflows plus push, followed by a real
Play review submission. Existing automated checks do not complete the device gate.

## Onboarding: what MVP actually needs

The normal entry path is login → worker welcome → a three-step introduction
(or Skip) → Home. Introduction completion is saved per worker/employment, and
Settings offers introduction replay. The agency's invitation email starts web
account setup before the worker downloads the app. Mobile has no sign-up or
account-setup redirect; pending access states offer agency support guidance.
Password recovery and public legal links remain available.
This is enough onboarding for MVP once the journey is tested on Android.

The older `app/(auth)/onboarding/` URLs now redirect to the normal entry point.
The sample profile-completion screen and GPS/flowsheet/voice promises are removed.
The existing welcome and three-step introduction remain. A live completion meter,
personalized checklist and native invitation acceptance are future improvements.

### Recovery and permission cleanup — 2026-10-03

- [x] Add a pre-sign-in **Forgot password?** link to the selected environment's
      website `/forgot-password` page. Password reset remains on the web; the
      worker returns to the app to sign in. Missing configuration or browser
      failures show a recoverable error rather than opening another environment.
- [x] Redirect every retired onboarding route to `/`, which selects login,
      worker welcome or Home based on the existing session and entry checks.
- [x] Remove `expo-location`, its config plugin and location requests. Android
      explicitly blocks coarse, fine and background location permissions.
- [ ] Configure `EXPO_PUBLIC_FRONTEND_URL` in each release's EAS environment,
      including production. The local staging file now uses the supplied staging
      website. No production URL is guessed or copied from staging.
- [ ] On an installed Android build, request a reset email, follow it, set a new
      password, and sign in again. Check pending/expired/no-access invitations and
      returning sessions separately. Automated link checks do not complete this.
- [ ] Inspect the newly built Android manifest. Existing installed builds and
      Expo Go retain their own native permissions until rebuilt/replaced.

Contextual push permission handling, public privacy access and production recovery
verification remain release gates. Removing location access does not remove the
external directions action, which passes the visit address to the maps app.

## After the Android MVP release

**Next release:**
- [ ] Check-in/check-out with GPS verification and location failure handling.
- [ ] Actual worked hours and punctuality derived from recorded attendance.

**Later releases, prioritized after MVP feedback:**
- [ ] Worker self-service availability.
- [ ] In-app invitation acceptance and account/profile setup.
- [ ] Richer onboarding with real profile completion and personalized guidance.
- [ ] Voice-to-text progress notes.
- [ ] Digital flowsheets and visit task checklists.
- [ ] Attendance leaderboard once attendance is recorded.
- [ ] Extra animations, skeletons and contextual nudges.
- [ ] iOS/TestFlight/App Store release work.

Deferred work does not block the Android MVP. Existing partial availability
changes in the working tree do not change this scope decision.

## Identity and access

- Current production label: HomeCare Worker App; final brand needs confirmation.
- Current Android application ID: `com.homecareapp.worker`; confirm before first upload.
- Version: 1.0.0. EAS production auto-increments the remote build version.
- EAS project: `124a574b-172d-4691-b959-b54a474f78ae`.
- The browser's current Google login opens Play Console registration rather than
  an existing developer account. Sign into the intended verified developer account
  or complete registration and verification.
- Given the app's patient care information, assess it as a health app. Google's
  account policy requires Organization accounts for health apps. Confirm the
  applicable health declaration in Play Console; do not use a personal account to
  bypass organization verification.

## Store listing draft

App name: HomeCare Worker App (pending brand confirmation)

Short description:
View care visits, access client details, and record progress notes.

Full description:

HomeCare Worker App helps home support workers stay connected to their agency
throughout the working day. An invitation and an active worker account from a
participating agency are required.

- See today's visits and upcoming shifts from Home.
- Browse your schedule and open visit times, addresses, and care instructions.
- Access assigned clients and their visit history.
- Write progress notes and add follow-up entries to saved notes.
- Review your profile and upload credential documents for your agency.
- Read agency updates in the notification inbox.

Weekly completed-hour summaries are estimates based on scheduled visit durations.
They are not verified attendance or payroll records.

Release notes:
First Android release with worker schedules, client information, progress notes,
credential uploads, and agency notifications.

## Required before sending for review

- [ ] Verified Play developer account and access to the intended app record.
- [ ] Final app name, support email, developer identity, countries and distribution.
- [ ] Final public privacy-policy URL and a working in-app link. The repository's
      current `/privacy` page is explicitly a pre-launch draft. Confirm legal
      entity/contact, actual data processing, subprocessors, regions, retention,
      deletion requests and any care-record retention obligations before publishing.
- [ ] Accurate Data safety, health-app, content-rating, target-audience and ads
      declarations based on the actual app and services. Do not submit guesses.
- [ ] Confirm the release remains existing-account login only: agency email →
      web account setup → app download → mobile sign-in. No mobile sign-up or
      account-setup redirect. This flow supports an outside-scope interpretation
      of Google's account-creation deletion trigger; it is not Google sign-off.
      Complete Data safety answers accurately and reassess if the flow changes.
      Dedicated mobile deletion-request entries are removed. The separate web
      privacy-request channel and operator helper remain; see
      `PRIVACY_REVIEW.md` and `backend/ACCOUNT_DELETION.md` for operational readiness.
- [ ] Confirm production backend, auth and website URLs in EAS **production**.
      Local `.env.production` does not configure a cloud build. Website is needed
      for Settings password reset and privacy links.
      Audit result: EAS production has the backend URL, auth URL and public key
      variables; `EXPO_PUBLIC_FRONTEND_URL` is absent both remotely and in local
      production settings. Presence does not prove service compatibility.
- [ ] Verify the live backend supports the worker endpoints used by this checkout.
- [ ] Inspect final Android permissions; remove unused location declarations and
      requests for this release. GPS is explicitly deferred; keep only permissions
      required by included features, including implemented push notifications.
- [ ] Create a signed Android App Bundle using the production profile; preserve
      the signing credentials. Confirm the bundle's package, API target and version.
- [ ] Test the Play-distributed build on an Android device using fictional data.
- [ ] Supply an app icon, feature graphic and genuine Android screenshots without
      patient or worker personal information. Confirm asset specs in Play Console.
- [ ] Add a stable reviewer worker account and complete access instructions through
      Play Console's App access form. Keep credentials out of this repository.
- [ ] Finish Play setup, upload the selected bundle and explicitly send for review.
      An upload or an internal-test release is not a production review submission.

## Reviewer access preparation

Use a dedicated demo agency with fictional client profiles, scheduled visits,
completed visits, notes and example credentials. Complete the worker invitation
and password setup before providing access. Ensure the reviewer can sign in
without needing a fresh email invitation or an inaccessible one-time code.

Suggested reviewer walkthrough: sign in, finish or skip the introduction, open
Home, view weekly totals, open a scheduled visit, open a client, save a progress
note on a demo visit, view credentials and notifications, and open Settings.

## Device acceptance checks

- [ ] Fresh install, sign-in, wrong password, session restore and sign-out.
- [ ] Web invitation/password setup → first mobile login → welcome or Skip → Home;
      returning login and pending/expired/no-access states; no sample onboarding.
- [ ] No mobile sign-up, account-setup redirect or dedicated deletion-request
      entry. Account help directs workers to their agency; recovery still works.
- [ ] Home, schedule navigation, clients and visit details load from production.
- [ ] Save and reopen a progress note; a failed save preserves the draft.
- [ ] Upload and reopen a supported credential document.
- [ ] Notification inbox, password reset and final privacy policy open correctly.
- [ ] Password recovery can be started before sign-in and returns a working login.
- [ ] Push arrives for the agreed events in foreground, background and closed-app
      tests; tapping opens the correct authorized record, including after login.
- [ ] Denied notification permission leaves the app/inbox usable; signing out or
      switching workers does not deliver the previous worker's notifications.
- [ ] Android back button, modal dismissal, keyboard and small-screen scrolling.
- [ ] Network loss and expired sessions show actionable errors, not false success.
- [ ] No cross-agency or other-worker records are exposed by the demo account.

## Verification recorded

These results describe earlier checks, not sign-off on later working-tree changes.

- TypeScript validation passed during this preparation.
- All 28 existing mobile home, schedule and environment tests passed.
- Android JavaScript/Hermes export passed using local production configuration
  after the Settings fixes. This is not a signed Android App Bundle.
- Native device walkthrough, signed release bundle and Google review submission
  have not been completed by this preparation.

### Recovery cleanup checks recorded 2026-10-03

- TypeScript check and all 10 website-link/environment tests passed.
- Android Expo manifest and JavaScript bundle served successfully after restarting
  the staging preview; the bundle contains the recovery action and staging website.
- Expo native-config introspection marks coarse, fine and background location for
  removal and contains no iOS location usage-description keys.
- Staging recovery/privacy/terms/DPA URLs returned HTTP 200 without authentication.
- These checks do not verify email receipt, password-reset completion, physical
  device behavior, a signed production bundle, or a Google Play submission.

### Settings and legal review recorded 2026-10-03

- Me now exposes Settings with real phone notification controls, public legal
  links, password recovery and introduction replay. Sign-in exposes Privacy/Terms.
- Mobile TypeScript and all 10 environment/website-link tests pass; the admin
  website production build passes (existing bundle-size warning).
- Privacy/Terms/DPA draft source now describes the mobile implementation. It has
  not been deployed or approved as final; the version remains `0.1-draft`.
- [PRIVACY_REVIEW.md](PRIVACY_REVIEW.md) records the existing-account mobile flow,
  separate web privacy requests, acceptance authorization issue and legal/operational confirmations.
  These remain release work, not completed compliance checks.
- Physical-phone Settings interaction, email receipt/password change and signed
  Android permission behavior still need the user/device walkthrough.

## Official references

- [Play account requirements](https://support.google.com/googleplay/android-developer/answer/10788890?hl=en)
- [Prepare an app for review](https://support.google.com/googleplay/android-developer/answer/9859455?hl=en)
- [Personal-account testing requirements](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en)
- [User data and privacy](https://support.google.com/googleplay/android-developer/answer/10144311?hl=en)
- [Account deletion requirements](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en)
- [Expo Android submission](https://docs.expo.dev/submit/android/)
