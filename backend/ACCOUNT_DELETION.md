# Worker account-deletion requests

Implemented locally on 2026-10-09. This is a manually reviewed process, separate
from employment offboarding. No real account has been deleted as part of building
it. There is no worker-accessible or agency-admin deletion API.

The mobile app is for existing worker accounts, set up through agency email
invitations on the website. It has no sign-up, account-setup redirect or dedicated
deletion-request entry. This runbook covers the separate web privacy-request
process; it does not establish that Google requires deletion UI for this app.

## Before publishing

- Set `VITE_PRIVACY_CONTACT_EMAIL` to an existing, monitored mailbox in the website
  build environment. The public `/account-deletion` page shows no actionable email
  link if configuration is missing or invalid; that state is **not release ready**.
- Confirm delivery to that mailbox and assign an operator to monitor it. Opening
  the email composer does not submit a request. Do not claim receipt before an
  email actually arrives.
- The website privacy policy links to `/account-deletion`. Keep store declarations
  consistent with the actual mobile account flow and available privacy practices;
  reassess Google's requirements if mobile account creation is introduced.
- Agree on retention schedules, applicable response deadlines, provider and backup
  expiry, and restricted storage for request records with the agency. Publish the
  final privacy policy and legal operator/contact details. The existing draft is
  not replaced or approved by this implementation.
- Test the deployed page while signed out and receipt
  of a fictional request. Verify a fictional deletion on a disposable local/staging
  Auth account, including old-token rejection and failed-request recovery. Unit
  tests use SQLite and mocked Auth; they do not prove live provider behavior or
  PostgreSQL locking.

## Intake and review

1. Record the request in a restricted case register, with an opaque reference,
   received date, operator, applicable due date and contact method. Do not put
   case files in Git, app notifications, analytics or patient records.
2. Verify identity proportionately. A supplied email address or logged-in session
   alone is not authority to remove another person's account. Ask only for evidence
   actually needed; never ask for their password or patient details.
3. Acknowledge receipt and state the expected completion date. Explain access
   consequences, retained categories, grounds, time periods and any additional
   steps. Record the worker's confirmed scope before irreversible processing.
4. Identify the exact Person, Auth user and **all** employments, including past
   agencies. Resolve open invitations/rehire plans with the agency before cleanup.
   Coordinate current visits; the deletion tool never cancels shifts or terminates
   employment.
5. Review each category below. A retention decision needs a real reason and a
   future review date; dates are not automatically invented or applied globally.
   An agency's preference to keep everything indefinitely is not a retention basis.
6. Complete the reviewed application cleanup, provider/storage work and backup
   handling. Send a completion/partial-completion explanation with outstanding
   steps and retained-record reasons and dates. Do not close the case just because
   the operator script succeeded.

### Current workers, administrators and incomplete invitations

All of these people may submit requests through the public page. The automated
operator helper below is intentionally limited to **former workers** whose every
employment is marked terminated and closed (`deleted_at` set). This is a tool
safety boundary, not a policy that people must resign before making a request.
Do not mark employment terminated merely to get past the helper. For an active
worker, coordinate an access arrangement and review the request individually;
escalate necessary implementation/agency decisions and maintain a due date.
Never leave the person waiting indefinitely for employer permission.

An administrator/owner also needs ownership and agency access reviewed separately.
An unaccepted invitation has no Person/employment to process with this helper;
review invitation revocation and the associated Auth identity separately. Existing
offboarding and invitation-revocation endpoints are not complete data deletion.

## What the helper removes and preserves

Always removed on successful execution:

- The exact reviewed Supabase Auth user, by hard deletion. This removes the usable
  authentication identity; a ban is not substituted for deletion.
- This person's linked push devices and delivery-token copies (including stale
  deliveries on a device they own), notification read markers and activity read
  markers. Shared notification and agency activity contents remain for review.
- The Person's Auth link. The Person and Employment rows are never deleted.

Only removed when explicitly selected in the plan:

- Nullable profile fields: phone, gender, birth date, address, languages, pet
  tolerance, preferred client types and emergency contact fields.
- Recurring availability entries. These represent current/future preferences;
  they are not historical visit assignments.
- Contact email: `replace_email` substitutes a unique non-deliverable address
  under `deleted.invalid`. Retain the email only with a reviewed purpose. Replacing
  it deliberately disables the existing automatic rehire-by-email association;
  do not automatically reconnect a new account to archived personal data.

Retained categories that require an explicit reason and review date:

| Plan category | Scope to review |
| --- | --- |
| `remaining_profile` | Name/author identity, email if kept, all unselected profile fields, and availability if kept. State which fields remain necessary and why. |
| `employment_and_care` | Employment dates, wage records, visits/modifications, progress notes and author attribution, care-slot assignments, leave and overtime records, billing evidence where applicable. |
| `credentials` | Credential metadata, verification evidence, current uploaded files and orphaned/replaced storage objects. |
| `agency_history` | Notification payloads, activity details, placement interests and other agency audit/history containing the worker's information. Read markers are removed by the helper. |
| `providers_and_backups` | Auth/provider logs, email/push providers, monitoring data, request correspondence, backup copies and local device caches. |

The helper does not delete those retained records or storage objects. If review
finds no lawful/legitimate need to keep them, carry out separately scoped removal
before closing the case; do not write a fictitious retention reason to proceed.
Storage paths must be reviewed within the person's folder, including older file
extensions that no longer appear in the credential table. Preserve authorship
needed for care accountability and avoid bulk cascading deletion of Person.

Legal minimums are specific to records and jurisdictions. For example, NL Labour
Standards Act section 63 covers specified employee records for four years from
the last entry. It is not a four-year blanket rule for every field. Confirm the
agency's applicable clinical, employment and security duties before execution.

## Operator helper

Requires trusted backend access; do not expose it as an HTTP endpoint or call it
from the public page. Use a private case directory with restricted filesystem
permissions outside the checkout. Use the existing backend environment selection
carefully: configuration loads environment variables and `.env.local`/`.env`.
Never paste secrets into commands, receipts or chat.

1. Prepare a JSON plan using the shape below, with the verified UUIDs, opaque case
   and operator references, selected fields and actual reviewed retention grounds.
   Every one of the five retention categories must appear exactly once. Replace
   the example placeholders; they are not production retention decisions.
2. Run a preview from `backend`, specifying the expected environment and hosts.
   A preview queries application data only; it does not call Auth or write data.
3. Review the output against the case. Execution requires that exact review token;
   changes to the plan, profile, memberships or cleanup counts invalidate it.
4. Run execution with a **new** private receipt filename. Archive the plan and
   receipt in the case register. Check remaining provider/record actions.

```json
{
  "person_id": "<verified-person-uuid>",
  "expected_auth_user_id": "<verified-auth-uuid>",
  "expected_employment_ids": ["<every-reviewed-employment-uuid>"],
  "request_reference": "CASE-123",
  "operator_reference": "OPERATOR-1",
  "identity_verified": true,
  "agency_reviewed": true,
  "remove_profile_fields": ["pet_tolerance", "preferred_client_types", "languages", "emergency_contact_name", "emergency_contact_phone", "emergency_contact_relationship"],
  "remove_availability": true,
  "replace_email": false,
  "retention": [
    {"category": "remaining_profile", "reason": "<specific reviewed reason and fields>", "review_on": "<YYYY-MM-DD>"},
    {"category": "employment_and_care", "reason": "<specific reviewed obligations>", "review_on": "<YYYY-MM-DD>"},
    {"category": "credentials", "reason": "<specific reviewed obligation>", "review_on": "<YYYY-MM-DD>"},
    {"category": "agency_history", "reason": "<specific reviewed purpose>", "review_on": "<YYYY-MM-DD>"},
    {"category": "providers_and_backups", "reason": "<provider expiry and backup handling>", "review_on": "<YYYY-MM-DD>"}
  ]
}
```

```text
python -m scripts.worker_account_deletion --plan <private-plan.json> --expected-environment <environment> --expected-auth-host <auth-hostname> --expected-db-host <database-hostname>

python -m scripts.worker_account_deletion --plan <same-private-plan.json> --expected-environment <environment> --expected-auth-host <auth-hostname> --expected-db-host <database-hostname> --execute --review-token <reviewed-token> --receipt <new-private-receipt.jsonl>
```

Execution locks invitation writes, then the Person and employments in PostgreSQL,
rechecks scope and the preview token, checks the Auth identity, deletes Auth, and
commits only the selected application cleanup. No migration is needed. Existing
push-device and push-delivery migrations must already be applied.

### Failure recovery and session limitations

Auth and application SQL are **not one atomic transaction**. Receipts record
`started`, `review_validated`, `auth_deleted`, and `database_committed` phases.
An absent phase is not proof an external action did not happen (a process can
stop between an action and its receipt write).

- If Auth fails, application cleanup rolls back. Inspect provider status; never
  assume an ambiguous network response means Auth was untouched.
- If Auth succeeded but SQL failed, keep the original expected Auth ID in the
  plan, preview again and retry with a new receipt. Only the precise Auth
  `404 / user_not_found` is accepted as an already-removed identity; transport,
  authorization and arbitrary 404 errors stop processing.
- If SQL committed but receipt/output failed, the Auth link is already absent.
  The helper refuses replay; verify the case rather than targeting a new identity.
- Supabase access JWTs may remain cryptographically valid until expiry after
  user deletion. The API uses server-side `auth.get_user(token)` plus database
  membership checks; test rejection with a previously issued fictional token.
  Audit direct Storage/Data API policies too, and allow already-issued signed
  download URLs to expire. Do not claim remote erasure of offline device caches.
- When a backup is restored, reapply completed deletions before returning it to
  service. Track provider cleanup and backup expiry separately in the case.

## Verification

```text
python -m pytest tests/services/test_account_deletion.py -q -p no:cacheprovider
python -m ruff check app/schemas/account_deletion.py app/repositories/account_deletion_repository.py app/services/account_deletion_service.py scripts/worker_account_deletion.py tests/services/test_account_deletion.py
```

Public-page browser coverage: `admin-frontend/tests/account-deletion.browser.cjs`.
Mobile links: `npm run test:website-links` in `worker-mobile-app`.

References: [Google deletion requirements](https://support.google.com/googleplay/android-developer/answer/13327111),
[Supabase user deletion](https://supabase.com/docs/guides/auth/managing-user-data),
[NL Labour Standards Act](https://www.assembly.nl.ca/legislation/sr/statutes/l02.htm).
