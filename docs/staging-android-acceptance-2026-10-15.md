# Staging Android acceptance

Started October 15, 2026; updated October 16. Status: staging configuration and test fixtures prepared; backend deployment healthy; installation reported and partial phone checks recorded below. Progress-note fixes need a new APK and device retest. Full phone acceptance remains pending. Subsequent production Firebase provisioning is recorded in the mobile README and release worksheet; production backend delivery remains disabled.

## Build and configuration

- Source: staging commit `6eccb3214f7f52d9fb781bbec343b5bedd4bd8cc`; no mobile source changes were needed during preparation.
- Expo project: `124a574b-172d-4691-b959-b54a474f78ae`, `@fumzy123/worker-mobile-app`.
- New build: [d5256971-f60d-4db4-8b85-4ff6e77b9046](https://expo.dev/accounts/fumzy123/projects/worker-mobile-app/builds/d5256971-f60d-4db4-8b85-4ff6e77b9046), profile `preview`, internal Android APK, app version 1.0.0 / build 1. This is a standalone build, not Expo Go or a development-server session.
- Build finished successfully on October 15 at 13:35 America/St_Johns. [Installable APK](https://expo.dev/artifacts/eas/UxRS2N6yxZslR56mgACWlJrwSJizB1QzAVOt43nkRCQ.apk). Build success is not phone acceptance.
- Expected label/package: Care Harbor (Staging), `com.homecareapp.worker.staging`.
- Existing staging signing credentials were inspected and reused with `--freeze-credentials`. No signing keys were downloaded, changed or revoked.
- Existing FCM v1 credential belongs to Firebase project `homecare-staging-2026` and is assigned to the staging Android package.
- Added missing EAS preview `EXPO_PUBLIC_FRONTEND_URL` pointing to the canonical staging website.
- Added missing EAS preview file variable `GOOGLE_SERVICES_JSON` with secret visibility. Its existing client file was found in Downloads and checked to match the staging Firebase project and package. The file is ignored by Git. The service-account private key remains in Expo credentials and is not included in the app.
- Verified the cloud backend, Auth and website URLs match staging. Account-level preview variables were empty. No production variables were read or changed for this setup.
- Uploaded a mobile-only source archive, with no backend files or unrelated admin edits. Inspection found no environment files, private signing keys, service-account files or credentials.json. The local staging Firebase client configuration is intended app configuration.
- Prior build `691a9ba6-0cb9-4f14-b59f-49d11eb8036f` was a development-staging build from October 2. The user has Expo Go and an older installed app of uncertain version; neither is accepted as the current release-test build.

## Backend delivery

- Staging migration: `c4e9812ab760`, including push-device and delivery migrations.
- Prior to enablement: one staging device registration; zero delivery rows or unexpired queued messages.
- Set `PUSH_ALLOWED_APP_IDS=["com.homecareapp.worker.staging"]` and `PUSH_DELIVERY_ENABLED=true` on the staging service only.
- Configuration redeployment: `67e9593a-72a9-4ab7-a535-bf8246701532`, source `6eccb32`; verified SUCCESS and online with one running replica and no reported failures. Actual phone delivery and provider receipt checks remain pending.
- Enhanced Expo push-security requirements, if any, will be verified by actual delivery/receipts. No token was invented or copied from another environment.

## Automated checks and test records

- Mobile TypeScript: passed.
- All 39 existing mobile environment, website-link, push, schedule, profile and action-stack tests: passed.
- All 39 focused backend push-device and push-delivery tests: passed. Pytest reported only an inability to write its local cache directory.
- Retained agency: DISPOSABLE Browser Auth 68276d5a. The admin and worker invitation/password setup were verified in the preceding browser authentication session.
- Prepared one fictional client, Fictional Android Client 68276d5a, and four one-hour companionship visits using the existing ClientService and ShiftService against staging. This is fixture setup, not an HTTP or phone acceptance result.
- Visits: October 15 at 09:00 and 16:00, October 16 at 10:00, and October 22 at 10:00, agency local time America/St_Johns. Revisit dates if phone testing occurs later.
- Client care instructions and an explicitly admin-only note support visibility testing. No real patient data was used. Fixture IDs are retained privately in `.cache/android-staging-state.json`.

## Phone checks still required

Downloaded and inspected the signed staging APK on October 15: package
`com.homecareapp.worker.staging`, label Care Harbor (Staging), version 1.0.0 /
versionCode 1, minimum Android API 24 and target API 36. No coarse, fine or
background location permissions appear. Notification permissions are present.
The manifest also contains framework-contributed overlay and legacy storage
permissions (storage capped at API 32); review these before final release.
Manifest inspection does not verify installation or phone behavior.

Device reported by the user: Samsung Galaxy S25 Ultra, Android 17. Installation of the new build and test results still require confirmation.

### User-reported device progress — October 15

The user reports **installed and already signed in**. This confirms their reported
installation/sign-in state only. The installed build identity, signed-in worker,
core workflows and push behavior have not yet been verified. Next: identify the
test worker and check Home, Schedule and Clients against the fictional fixtures.

The user's subsequent phone screenshot shows Home loaded on October 15 at 23:38:
greeting Fictional, two visits today with the last ending at 17:00, two estimated
completed hours out of three scheduled this week, two progress-note attention
items, and an inbox badge of four. The visible attention item names the prepared
Fictional Android Client 68276d5a and the October 15 16:00 visit. This is evidence
of Home rendering the expected fixture data without a visible loading/error state.
The exact worker email, installed build identity, other screens and external push
delivery are not established by this screenshot. Schedule and client details are
the next device checks.

The next user screenshot (23:41) confirms the prepared October 16 visit details
open successfully: Fictional Android Client 68276d5a, Upcoming status, Friday
October 16 2026, 10:00–11:00, Companionship, one hour, the fictional St. John's
address, and `ANDROID ACCEPTANCE 68276d5a / tomorrow` shift instructions.
This passes the specific visit-details display check. The screenshot does not
establish week/two-week navigation, Directions behavior or client-profile access.
Next: open the fictional client from Clients and inspect care information/history.

The user's 23:44 screenshots confirm the fictional client profile opens with its
expected name, address and birth date. Your visits reports four October visits,
newest first; the visible October 22 and 16 visits are scheduled at 10:00–11:00,
and the October 15 16:00–17:00 visit is completed. Care profile displays the
expected scented-products allergy example and favourite-book care instructions,
missing-data messages for care focus and medications, and the fictional emergency
contact. No admin-only note is visible in the supplied screens. These pass the
observed client-profile, care-information and visit-list rendering checks; they
do not establish API-level data exclusion, month navigation, calling or Directions.
Next: save and reopen a note on the October 15 16:00 completed visit.

### Staging UI update requested during the walkthrough

The user requested a soft orange oval and filled icon for the selected bottom
tab, and Settings above the agency-support section on Me. Both changes are in
the mobile source; TypeScript and diff whitespace checks passed. A new EAS
`preview` build was requested using staging services and the existing HomeCare
Staging signing key: `2c4d645c-4d97-43ee-a982-882b9df7e533`.
Phone screenshots above belong to the earlier installed APK. Progress-note
save/reopen remains pending; the UI change is not evidence of that test passing.

The build finished at 2026-10-16 02:35:34 UTC. Download:
https://expo.dev/artifacts/eas/Dwtui09OxGq_vEJiigWLrbOX9qZvdDAWLfso8VwIZG0.apk
Downloaded APK inspection confirms Care Harbor (Staging),
`com.homecareapp.worker.staging`, version 1.0.0 / code 1, minimum API 24 and
target API 36. APK signature verification passed; its signing certificate SHA-256
matches the earlier staging APK. File SHA-256:
`3181c7009da9b3998cdbd9101aa322e90cea82539f652aedc6a4caf183780a97`.
Installation and visual verification of this update remain pending.

### Progress-note feedback on the earlier installed APK

The user supplied a reopened note-sheet screenshot showing two entries at 23:54
and 23:55, including the requested fictional visit note and a follow-up. This
supports saved-entry/follow-up display on the phone. The user reports the first
Save tap dismisses the keyboard and moves the sheet; a second tap saves. Record
this as a device usability defect, not a passing single-tap save test. They also
report insufficient visual separation between saved entries and the writing area,
and ask about long-note reading. Source inspection shows saved-entry Text has no
line limit or fixed card height; entries expand within the sheet's ScrollView.
The shared sheet already uses keyboardShouldPersistTaps="handled", but the shift
detail renders the sheet under its own ScrollView without that setting. Ancestor
tap interception is a candidate cause, not yet reproduced or confirmed.
The completed UI-update APK above does not include progress-note fixes.

### Progress-note fixes in source — October 16

Moved the note sheet outside ShiftDetailView's ScrollView, matching the existing
Home and Schedule placement, so that scroll ancestor cannot consume the first
Save tap. The sheet retains keyboardShouldPersistTaps="handled". This addresses
the candidate cause; single-tap saving with the Samsung keyboard remains a
required device retest.

Added a saved-entry count, bordered white cards with Progress note / Follow-up
labels and times, and a separate writing section. Entries over 240 characters or
four explicit lines have four-line previews and Read full note. The reader fills
the screen, scrolls the complete selectable text, and returns to the same form
state without discarding the draft. Successful saves now show confirmation;
failed saves retain text and the existing stale-record/retry safeguards.

TypeScript and targeted whitespace checks pass. A local interaction harness with
real React/TanStack Form and DOM stand-ins for native controls passed short/long
entry display, the full 10,000-character reader, reader-back draft preservation,
one submission per Save press, success confirmation and failed-save draft
retention. This is not native keyboard/layout verification. The source changes
are not included in build `2c4d645c-4d97-43ee-a982-882b9df7e533`; a subsequent
staging APK is needed for the phone retest.

- [ ] Install the new signed staging APK; verify label, package, version and effective Android permissions (no location access).
- [ ] Worker login, welcome/skip, Home, returning session, wrong password and sign-out.
- [ ] Schedule navigation, assigned client details, care instructions and visit history; admin-only notes remain hidden.
- [ ] Save/reopen a progress note and append a follow-up; failed-save draft survives network loss.
- [ ] Profile edit, fictional credential upload/open, inbox and read state.
- [ ] Recovery and legal links use staging; password reset works from the phone and mobile sign-in succeeds afterward.
- [ ] Enable notifications; verify backend registration belongs to the fictional worker and staging app.
- [ ] Generate fresh assignment/change/cancellation events; verify foreground, background and closed-app delivery and taps, plus provider receipts.
- [ ] Denied permission leaves Home/inbox usable; logout/account switch removes or reassigns registration and prevents previous-worker delivery.
- [ ] Back button, keyboard, small-screen scrolling, expired sessions and access-denied states behave correctly.

Known separate release items remain in `worker-mobile-app/GOOGLE_PLAY_RELEASE.md`: production configuration, final legal content, store/account declarations and Play submission. This worksheet is not release sign-off.
