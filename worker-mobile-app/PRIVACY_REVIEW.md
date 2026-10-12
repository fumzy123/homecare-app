# Worker Android privacy and account review

Reviewed 2026-10-03; worker access and request scope updated 2026-10-09. This is an implementation
review and draft preparation, not legal approval or a production configuration
audit. The public documents remain version `0.1-draft`. No deployment, worker
acceptance record or Google Play submission is created by these document edits.

## Mobile access to documents and controls

- Me → Settings: phone notification permission/status, Privacy Policy, Terms,
  agency DPA, web password recovery and introduction replay.
- Sign-in also links directly to Privacy and Terms without authentication.
- Notification controls open phone settings when registered/blocked; they do
  not navigate to the inbox. Expo Go explains that phone alerts require an
  installed Android build. Existing notification registration remains responsible
  for refreshing permission state on foreground and unlinking devices on sign-out.
- All website actions use `EXPO_PUBLIC_FRONTEND_URL` for the selected environment.
  Local `.env.production` had no website URL at review time. EAS production is
  separate and has not been verified. Configure its production environment too;
  do not ship a staging website fallback. Validate recovery redirects in the same
  production Supabase project and test the signed build.

## Evidence and disclosure changes

| Area | Source evidence | Draft treatment |
| --- | --- | --- |
| Worker/client data | `backend/app/models/person.py`, `client.py`, employment and credentials; worker client/profile services | Identity/contact/emergency details, health/care information, credentials, schedules, progress notes and agency scope |
| Sessions | `src/shared/lib/api-client.ts`, `app/_layout.tsx` | Secure mobile sessions; query cancellation/clearing on account change |
| Uploads | `src/features/profile/lib/uploadDocument.ts`, backend credential service | Worker-selected documents, temporary file copies, private storage/signed download links; no promise all local files clear on logout |
| Push | `src/features/notifications/lib/pushRegistration.ts`, `backend/app/domain/push.py`, push delivery services | Device identifiers/tokens, permission, delivery records, Expo/FCM; patient-free lock-screen text; physical delivery still needs testing |
| Monitoring | `admin-frontend/src/main.tsx`, `backend/app/main.py` | Sentry is optional; web traces and error-triggered replay (text masked/media blocked) as well as error monitoring. Verify actual enabled services and captured data. Masking is not proof of zero sensitive data |
| Directions/attendance | mobile shift directions and app configuration | External maps receive destination; GPS visit verification is deferred; completed hours are estimated |
| Infrastructure | Supabase integrations; current Vercel/Railway/Resend staging setup; Expo/FCM/Stripe/Sentry integrations | Provider inventory is provisional until production contracts, entities, roles and regions are confirmed |

The Privacy, Terms and DPA pages now cover mobile use and distinguish agency
contract acceptance from worker access. Their existing commercial pricing terms
were preserved. Unverified fixed 30-day deletion and 72-hour breach commitments
were replaced with explicit draft decisions. This does not determine statutory
deadlines: applicable legal duties still require professional review.

## Acceptance is not a single checkbox

The agency DPA is for an authorised agency representative. Do not require workers
to execute it for the agency. A privacy notice explains processing; an
acknowledgement is not blanket consent for every future data use. Determine
whether separate worker-use terms are necessary, and request any required
specific consent when the relevant feature is used.

No worker acceptance gate was added. The current `/api/legal/accept` record is
organisation-level (version/time), not per-worker. It also uses
`get_current_user`, not an administrator/owner guard, so an authenticated worker
could reach this organisation acceptance endpoint. Before final contractual
acceptance, restrict that write to authorised agency roles, enforce active agency
scope and record the accepting actor. Do not reuse it for worker consent. This
pre-existing authorization issue is recorded here, not fixed by UI/document edits.

## Existing-account mobile access and privacy requests

The agency sends an email invitation. The worker follows that email to the
website, enters their name and sets a password, then downloads the mobile app
and signs in. Mobile offers no sign-up or account-setup redirect. Pending access
states direct workers to contact their agency. Password recovery, legal links
and agency support guidance remain available.

Google's published account-deletion trigger covers account creation inside the
app and app-directed external creation. The current independently initiated
email/web setup and existing-account mobile login support treating this mobile
flow as outside that trigger. This is a documented interpretation, not a Google
approval or a blanket exemption from privacy obligations. Invitation-only access
is not the same as permanently private Play distribution. Reassess the policy
before adding mobile account creation or account-setup links, and complete Play
Data safety answers based on the actual release.

The mobile Settings and sign-in deletion-request entries were removed on
2026-10-09. The public website retains `/account-deletion` as a separate privacy
request channel. It uses `VITE_PRIVACY_CONTACT_EMAIL` for a monitored email
pathway without sign-in. Missing configuration is explicitly unavailable, not a
functioning request channel. No mailbox has been invented or provisioned.

The backend operator helper previews cleanup and requires a reviewed plan, exact
Auth/person/employment identities, a fresh review token and a private audit receipt.
It handles former-worker accounts only; workers cannot run it. It hard-deletes
Auth, unlinks the identity and removes push registrations/read markers and only
the selected profile fields/availability. Required care and employment records
are retained with explicit review decisions. It does not automatically close the
privacy case, delete credential storage, or fulfil provider/backup cleanup.
Active-worker and other cases still require individual handling, without an
automatic termination or blanket refusal. See `backend/ACCOUNT_DELETION.md` for
the operating procedure, recovery and remaining deployment/device verification.

`OrgMemberService.delete_member` soft-deletes employment and disables auth access.
Organisation closure and invitation cleanup are separate admin operations. They
do not supply a complete worker request and associated-data deletion process.
Neither a privacy link nor an agency removing a worker fulfils that process alone.

Before operating or publishing the web privacy-request process:

- Configure and verify the monitored web request channel and assign responsibility
  for handling requests with the agency. The current mobile scope does not include
  a dedicated deletion-request entry.
- Verify identity and authority, acknowledge the request, coordinate with the
  agency, and define what is deleted, anonymised or retained and for how long.
- Separate account identity and credential files from care-history obligations;
  confirm those obligations rather than erase patient records indiscriminately.
- Cover auth, database, storage, push registrations, providers, logs and backup
  expiry; verify other workers/agencies retain only their authorised records.
- Publish timeframes, retained-data reasons and support details and test the
  process. Store declarations must accurately reflect the implemented practices.

## Owner decisions and operational verification still needed

1. Legal operator name/entity type, jurisdiction, public support/privacy contact
   and service/mailing address. Product branding alone is not the legal identity.
2. Production website address, matching auth redirects and build configuration.
3. Actual production provider legal entities, countries/regions, contracts and
   enabled logs/monitoring; confirm advertising/sale/secondary-use practices.
4. Retention periods for account/employment/care/credential/delivery/log records
   and backups; export/deletion request owner, deadline and escalation.
5. Security operating practices, backup/restore evidence, incident notification
   responsibilities/deadlines, SLA, liability, termination and confidentiality.
6. Final worker notice/terms decision and any required consent evidence. Finalise
   document versions and acceptance together, after review, not on a draft edit.

## Developer account for a solo operator

Google's account rules are based on business/app use, not team size or an office.
Care Harbor likely fits Medical → Healthcare Services and Management because it
handles care records and elderly-care logistics; this is an assessment, not a
Google classification decision. An Organization account remains the recommended
route. D&B issues D-U-N-S numbers to sole proprietorships as well as corporations;
incorporation must not be assumed necessary solely from the word Organization.
Confirm the intended Canadian legal identity and acceptable Google verification
documents before registration, with consistent D&B/payment-profile details.

## References

- [Google account types](https://support.google.com/googleplay/android-developer/answer/13634885?hl=en)
- [Health categories](https://support.google.com/googleplay/android-developer/answer/14738291?hl=en)
- [Account verification information](https://support.google.com/googleplay/android-developer/answer/13628312?hl=en)
- [D&B business types](https://docs.dnb.com/office-apps/en-US/DUNS-Number)
- [Google deletion requirements](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en)
- [Google user-data requirements](https://support.google.com/googleplay/android-developer/answer/10144311?hl=en)
- [Canadian meaningful-consent guidance](https://www.priv.gc.ca/en/privacy-topics/privacy-for-businesses/appropriate-handling-of-personal-information/collecting-personal-information-and-consent/consent/gl_omc_201805/)
- [Android settings guidance](https://developer.android.com/design/ui/mobile/guides/patterns/settings)
- [Supabase native recovery/deep linking](https://supabase.com/docs/guides/auth/native-mobile-deep-linking)
