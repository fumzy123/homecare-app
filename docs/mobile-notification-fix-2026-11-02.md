# Staging notification fixes — November 2, 2026

The user reported an Android process exit when opening a fully covered care request,
and approval notifications switching to Schedule without returning to Notifications.

## Diagnosis

EAS's latest standalone `preview` build before this fix is
`2c4d645c-4d97-43ee-a982-882b9df7e533`, created October 16 UTC (October 15 in
America/St_Johns). It predates service-type retirement in commit `222f5da` and
notification stack navigation in `3f7ed4f`. The supplied screenshot matches the old
inbox. The exact installed binary/device crash log was not available.

The pre-retirement `PlacementDetail` calls `slot.service_type.replaceAll()`. The
current API deliberately omits that field. Rendering that historical component
with a current fully covered care-slot fixture reproduces
`TypeError: Cannot read properties of undefined (reading 'replaceAll')`.
Current source displays `Care visit` and passes the same test.

## Changes shipped in the new source

- Include the existing field-retirement and stacked-schedule fixes in a fresh APK.
- Preserve notification source for care-request routes, show **Notifications** on
  their Back button, and recover to the inbox if a destination has no history.
- Keep schedule notification navigation on `/notifications/schedule`, above the
  inbox, so Android Back restores the same inbox route. The normal Schedule tab
  continues to work independently.
- Add rendered tests for full/partial/closed/legacy care requests, loading and
  access failure, inbox taps/read completion, and destination Back buttons.
  Exercise the installed Expo stack router's GO_BACK transition for both targets.
- Run the inbox/screen regressions in Mobile CI and increment preview build numbers.

## Validation and installation

All 76 tests from `node --test scripts/*.test.cjs` and `npm run typecheck` passed.
Native widgets are mocked in the renderer tests; these checks do not replace a
physical Android test. No backend changes or database migration are needed.

Install the new **preview / staging** APK over Care Harbor (Staging), keeping the
existing installation. A Git push or backend deployment cannot update the JavaScript
embedded in the old standalone APK. EAS Update is not configured in this project.

Phone acceptance:

1. Open the fully covered care-request notification. Confirm care slots and
   **Fully covered** display without closing the app; Back returns to Notifications.
2. Open **Your Care Slots are approved from…**. Confirm the notification schedule
   opens; check both its Back button and Android system Back return to Notifications.
3. Open a partially covered request and confirm only available slots accept interest.
4. Open a visit from the notification schedule, then Back twice to return to the inbox.
5. Check a phone push tap from the background and with the app closed still opens
   the authenticated inbox. Existing historical notification rows remain usable.

Build completion and physical acceptance must be recorded separately; automated
tests alone do not establish that the reported phone crash has been eliminated.

## Staging release record

- Source commit: `2c78f8311961c724fd1925c80fed5bd4b2bf5fce`, pushed to `staging`.
- [Mobile CI](https://github.com/fumzy123/homecare-app/actions/runs/41489846320):
  Mobile Type Check (including notification regressions) and Expo Doctor passed.
- [Staging APK build](https://expo.dev/accounts/fumzy123/projects/worker-mobile-app/builds/d8af3582-3711-4ec7-a080-fe35486d7aa2):
  profile `preview`, Android version code **4**, submitted; completion pending.
- EAS uses the existing **HomeCare Staging** signing key and preview-only secret
  `GOOGLE_SERVICES_JSON` file variable. No Firebase credentials were changed.
  The CLI's warning about the ignored local Firebase file does not mean the remote
  builder is missing its secret file variable.
- The initial workspace upload was blocked by an unreadable `.pytest_cache`;
  the submitted build uses a clean temporary clone of the source commit.
  Build `433a19ba-7991-4130-bb6c-1eb395d0f21a` was canceled during the Firebase
  configuration check and is superseded by the linked version-code-4 build.
- Physical-phone acceptance remains pending.
