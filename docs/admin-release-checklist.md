# Admin web release checklist

Updated October 16, 2026. Release target: one supported home-care agency using the admin web app with real records. The remaining gates combine product usability, privacy, security and dependable operation. Android distribution is a separate release unless the agency explicitly depends on a mobile workflow.

The October 15 staging reports are the acceptance baseline. Production settings and the current working-tree changes need verification against the exact release candidate. An unchecked item means completion evidence is still required, not necessarily that its code is missing.

## Owners and evidence

For this solo-developer launch, the developer owns engineering, deployment and initial support. The agency owner validates working practices and imported records. The developer settles business/privacy decisions with appropriate professional input where needed. These are proposed responsibilities, not commitments from an agency or an adviser.

For each gate, record: responsible person, tested commit, environment, date, result and a redacted evidence link. Keep credentials and patient details out of this checklist.

| Gate | Owner | Current state | Required acceptance evidence |
| --- | --- | --- | --- |
| Direct Care Slot assignment | Developer; agency owner validates UX | Implemented; isolated database and both browser entry points passed; hosted rollout pending | [Implementation evidence](../backend/DIRECT_ASSIGNMENT.md). Apply migration and repeat agency acceptance on the deployed release |
| Practical admin workflow | Developer and agency owner | Focused client setup handoffs implemented and locally tested; broader proposals and agency acceptance pending | Manager completes intake, first coverage, same-day change and replacement using supported screens without API assistance |
| Legal and privacy operations | Developer/operator | Public documents remain drafts; separate compliance chat opened | Final operator/contact details, reviewed agreements, provider inventory, retention and access/export/deletion/incident procedures |
| Security | Developer | Existing auth, role guards and tenant checks; hardening and broader verification open | Completed access matrix, offboarding tests, protected documents, safe telemetry and tested response headers |
| Recovery | Developer | Restore demonstration open | Successful isolated database and document restore; measured recovery time; agreed maximum data loss and outage duration |
| Monitoring and support | Developer | Sentry code exists; alert delivery not signed off | Synthetic error and outage reach the responder; stalled-job and billing failures are detectable; written response and rollback steps |
| Production auth and hosting | Developer | October 15 baseline healthy; final settings open | Correct production services, secrets, redirects, SMTP, domains and provider access; fresh confirmation/invite/recovery emails work |
| Production billing | Developer/operator | Staging test-mode acceptance recorded | Confirm tax/registration decision, actual runtime flags, live price/account mode and signed webhook processing; agreed controlled purchase evidence before paid rollout |
| Exact release candidate | Developer | Uncommitted auth/billing work exists | Deliberately selected changes, relevant tests and staging browser acceptance for that commit, clean deployment evidence |
| Agency onboarding and launch | Developer and agency owner | Open | Validated import, trained admin, written support/outage process, production smoke pass and explicit go/no-go |

## Existing staging evidence

- [Agency walkthrough](staging-agency-walkthrough-2026-10-15.md): intake, funding caps, partial and concurrent approval, stale reviews, recurring edits, assignment replacement, retained notes, isolation and filtered timesheet export passed within the report's scope. Overtime rejection and owner override passed; the full request/review inbox journey was not exercised.
- [Browser authentication](staging-browser-authentication-2026-10-15.md): registration, confirmation, invitation setup, sign-in, sign-out and recovery passed through the recorded deployed fixes. Later local confirmation changes require their own staging pass.
- [Billing acceptance](staging-billing-acceptance-2026-10-15.md): test-mode purchase, recovery, subscription changes, usage and retry behavior passed. Some time boundaries were simulated; production collection and tax decisions remain separate.
- [Environment baseline](release-readiness-2026-10-15.md): infrastructure and schema evidence is dated. Recheck the deployed versions before release.

## Work order

1. Deploy and accept the tested direct slot assignment change through the existing approval system. Preserve the worker-interest option. Continue discussion of the remaining [workflow proposals](admin-workflow-review.md).
2. Resolve privacy/business decisions in the separate compliance chat while engineering verifies the [production safeguards](admin-production-safeguards.md).
3. Complete security fixes, restore rehearsal and delivered alerts. Agree on the manual worker-contact process if mobile is outside this launch.
4. Select the release candidate. Include or exclude each local auth/billing change deliberately; do not deploy a mixture of tested and unfinished work.
5. Run automated checks and the staging acceptance script below. Promote through the existing staging-to-main process, confirm frontend/backend versions and database head, and retain the previous compatible release.
6. Run controlled production checks with designated fictional records. Import the first agency's data only after the real-data gates pass and the agency approves its records.

## Release candidate acceptance

- [ ] Build/type/lint checks, frontend component and relevant pure-function tests pass. Add the relevant tests to frontend CI; its present workflow does not run the complete component suite.
- [ ] Backend checks pass, and required PostgreSQL integration checks run against an isolated database. Record skipped tests explicitly.
- [ ] Fresh owner signup, confirmation, invite, expired/revoked invite, recovery, sign-out and returning-session behavior pass on the canonical staging site.
- [ ] A client moves from intake through funded/self-pay care, saved revision, request, direct or interested-worker approval and visible scheduled visits. Saving alone creates no visits.
- [ ] Coverage replacement and a new revision preserve history and unrelated visits; partial coverage remains visible. Two admins cannot approve the same slot twice.
- [ ] Same-day cancellation, one-occurrence edit and series rules are clear. Overtime request, owner review, approval/rejection and refreshed schedule are verified.
- [ ] Leave handling explicitly shows its effect on scheduled work; do not assume recording leave automatically reassigns visits.
- [ ] Credential upload, private preview, verification, expiry and Action Tower destination behavior pass.
- [ ] Notes survive failed saves and stale-write rejection without overwriting history. Browser back/refresh and expired sessions do not silently lose work.
- [ ] Keyboard use, supported desktop sizes/browsers, long lists, realistic agency volume, slow network and agency-timezone/DST cases are acceptable.
- [ ] Scheduled/automatically completed hours remain clearly distinguished from verified attendance and payroll.
- [ ] Billing tests match the selected release; failed payments, recovery, duplicate delivery and read-only access behave as intended.

## First agency handover

- [ ] Agree on launch workflows and limitations, including who contacts workers and records agreement.
- [ ] Map and validate imported clients, workers, care slots and schedules; reconcile counts and samples with the agency. Provide a manual import process if automated import remains deferred.
- [ ] Set agency timezone and roles; train the owner and at least one operational contact where available.
- [ ] Provide short instructions for routine scheduling, replacements, credentials, notes, exports and support.
- [ ] Agree on a secure, current scheduling fallback during outages and reconcile changes after recovery.
- [ ] Name the launch responder, support hours and escalation contact. Avoid promising continuous support that a solo developer cannot provide.
- [ ] Confirm actual production alert delivery, recovery access, release versions and critical workflows before opening access to real records.

## Deferred scope

AI scheduling, GPS/EVV, voice notes, flowsheets, iOS and cosmetic redesign are outside this admin release. Android/push remain separate if the agency can operate using direct assignment and its agreed communication process. Basic recoverability, tenant isolation and safe handling of real records are not deferred features.
