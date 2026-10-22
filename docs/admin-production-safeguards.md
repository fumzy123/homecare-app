# Admin production safeguards

Prepared October 16, 2026 for a solo developer releasing Care Harbor to its first agency. Security protects three things: confidentiality (only the right people see records), integrity (records and schedules change correctly) and availability (the agency can access or recover its work). These checks are proposed release work; this guide does not mark production as secure or change its settings.

## Browser security and passwords

Security headers are instructions sent with a website response that tell the browser what it may load and how it should handle the page. They are inexpensive safeguards, but they do not replace server-side permission checks.

| Control | Why it matters | Implementation and verification |
| --- | --- | --- |
| Content Security Policy (CSP) | Restricts scripts, connections and embedded content, reducing the impact of injected content | Inventory the app's actual resources, Auth/API, Stripe and monitoring domains. Start a restrictive candidate in report-only mode on staging, inspect violations, then enforce a tested policy. Report-only observes; it does not block attacks. |
| Frame restriction | Stops another site embedding the admin app in a deceptive interface that tricks an admin into clicking | Use an appropriate CSP `frame-ancestors` rule and compatible framing header. Verify the admin site cannot be embedded by an unrelated origin. This is distinct from allowing Stripe content inside our own page. |
| `X-Content-Type-Options: nosniff` | Tells the browser to respect declared content types | Set on appropriate served responses and verify correct types for scripts, styles and document delivery. Uploaded files still need validation and private access. |
| Referrer Policy | Limits address information sent when navigating or loading another origin | Choose an explicit policy appropriate to authenticated pages and verify external requests. Keep personal information and tokens out of URLs independently. |
| HTTPS and HSTS | Protect transport and instruct browsers to use HTTPS | Verify every production service and supported hostname. The October 15 site inspection recorded HSTS already present. |
| Leaked-password protection | Rejects passwords already known from breaches, reducing reuse risk | Enable in each intended Supabase project's password settings, then test signup and password reset with fictional accounts. Supabase currently documents this feature on Pro and above. It does not prove an existing account was compromised or replace MFA. |

The frontend's `vercel.json` currently contains a rewrite without these extra header rules. Prepare website headers there or through the chosen hosting configuration; evaluate API response headers separately. Test login, email callbacks, embedded Stripe checkout, file previews and downloads before promotion. Sanitize CSP reports too, because reports can contain URLs.

Sources: [MDN CSP guide](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP), [content type protection](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/X-Content-Type-Options), [Referrer Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Referrer-Policy), [Supabase password security](https://supabase.com/docs/guides/auth/password-security).

## Access and session verification

Use fictional Agencies A and B, with an owner, administrator and worker in each. Record the expected permission for each read/write action. Test the API directly as well as the browser: hiding a button is not authorization.

1. Attempt to read, update, export and delete the other agency's clients, workers, notes, care requests, assignments, credentials and billing records by substituting IDs. Expect denial without disclosure or mutation.
2. Attempt owner-only actions as an agency admin, admin actions as a worker, and operator actions as an ordinary owner. Altering user-editable profile metadata must not grant access.
3. Keep a session open, then deactivate/remove/demote that account through the intended process. Retry both reads and writes with its existing token, reload, refresh the session and use browser back. Verify the permitted revocation delay and that another user's cached data is cleared on account changes.
4. Check signed-out, expired, revoked, pending-invitation and deleted-account behavior. Verify organization suspension/deletion as well as employment state.
5. Review who can administer GitHub, Vercel, Railway, Supabase, Stripe, email and monitoring. Use individual accounts, MFA, least privilege and securely stored recovery codes; remove unnecessary access. Keep backend secrets out of frontend bundles, source history, logs and shared documents.

The current backend looks up roles in database employment records. However, `_get_active_employment` in `app/core/security.py` filters deleted records but does not itself check `is_active`. Trace the complete route/service path and test deactivation before concluding that all inactive admins are denied. This is an audit lead, not a verified exploit.

Signing out and token expiration are different events. Supabase documents checks against the session for strict post-signout invalidation; choose the required behavior and test it rather than assuming every issued access token stops immediately. [Supabase session guidance](https://supabase.com/docs/guides/auth/sessions).

## Document and telemetry protection

Credential files must remain private. Current admin preview code issues signed links lasting 120 seconds after a membership check. Such a link acts as a temporary access credential: a copied unexpired link may work without a fresh login. Test that an unauthorized user cannot obtain one, the link expires as intended, raw storage paths are not public, and uploads have controlled size/type/content. Decide whether immediate revocation requires a different delivery design.

Check cross-agency access to document metadata and file contents, including workers with multiple employment histories. Also check backup copies, overwritten file versions and failed uploads; a private bucket alone does not prove all these cases safe.

The frontend currently configures masked session replay on errors when Sentry is enabled; frontend/backend hooks remove request bodies. Those hooks do not by themselves establish that exception messages, URLs, query parameters, breadcrumbs, database traces or replay data are safe.

Use distinctive fictional names and note text, trigger controlled failures on staging, and inspect the outgoing telemetry and received events. Remove or redact care content, tokens and unnecessary identifiers; restrict access and retention. For MVP, disable session replay until its capture behavior and privacy terms have been verified. Retain useful technical context such as release, route template, status and request ID without copying patient records into diagnostics.

Run dependency audits and targeted security tests before release. [ZAP](https://www.zaproxy.org/getting-started/) is a free tool for web testing; use a bounded staging scan with fictional data. Automated scanning supplements the authorization matrix and business-rule tests, which it cannot infer from the agency model.

## Backup and restore for MVP

Yes: recoverability is needed before an agency depends on real records. A mistaken migration, accidental change or lost upload can occur on day one. Backups protect data; a restore rehearsal establishes whether those backups can actually recover the service.

Minimum practical process:

1. Inventory database, Auth dependencies, uploaded documents, required configuration and secret-recovery access. Keep backup access protected and separate from routine application access.
2. Confirm the actual production backup schedule, retention and failure reporting. Establish a separate strategy for uploaded documents and overwritten/deleted versions. Supabase database backups contain Storage metadata, not the stored files themselves. [Supabase backups](https://supabase.com/docs/guides/platform/backups).
3. Agree with the agency how much recent work it could tolerate losing and how long it could operate without the app. These are recovery point and recovery time objectives. For example, a daily-only backup may lose almost a day of new work; do not silently accept that for care operations.
4. Restore representative fictional data and files into an isolated environment. Disable email, push, live billing and scheduled outbound work in the restored copy; never let a rehearsal contact real workers or charge customers.
5. Verify client counts and sample records, care-slot/assignment links, notes, document contents, permissions and dates. Measure elapsed recovery time and record the steps and missing dependencies.
6. Rehearse again after material storage/schema/recovery changes. Ensure backup failure alerts reach the responder and retained copies follow the agreed privacy policy.

An isolated restore must not overwrite production. A backup alone is also not an outage workflow: the agency needs a secure current schedule and a way to record changes for later reconciliation.

## Monitoring and incident response for one developer

Monitoring tells you when the agency needs help before it has to explain the failure. A website can return a normal page while sign-in, the database or the billing scheduler is broken. Start with a small set of actionable signals.

| Signal | What to monitor | Proof before launch |
| --- | --- | --- |
| Availability | External checks of the website and a safe API readiness endpoint | A controlled staging outage reaches your chosen contact channel; the check distinguishes API/database readiness from a static homepage |
| Application errors | Sentry frontend/backend errors with release identifiers and scrubbed context | One deliberate staging error appears and produces an alert you receive |
| Background jobs | Last successful run, persistent failure and backlog age for trial/billing/shift jobs | A paused or failed staging job is detected even while the API remains online |
| Billing | Failed webhook processing, exhausted retries, stalled settlement and unexpected duplicates | A test-mode failure generates the intended alert; recovery does not duplicate an invoice |
| Backups | Recent successful backup and protected document copy | A failed/missing backup is detectable; the restore rehearsal is recorded |

Choose alert destinations you actually monitor, group duplicates and use sensible persistence thresholds. Set explicit support hours; a solo developer should not promise 24/7 response without coverage. Restrict alert text to technical context and a secure link.

Write a short response procedure: acknowledge → identify affected functions/agencies → contain harmful writes or collection where needed → preserve evidence → communicate through the agreed contact → recover → verify → reconcile records → document the cause and prevention. Assign a backup contact for absence where possible.

Keep the last compatible application release and a schema-aware rollback/forward-fix plan. Reverting application code is not the same as reverting data; restoring an older database can discard legitimate newer care records. Exercise rollback on staging.

The scheduler currently starts inside every backend process. Keep one web process and one replica, and review overlap during deployments, until jobs have deliberate cross-process coordination. A single replica setting alone does not prove there is only one scheduler during rolling deployment. Existing idempotency and locking safeguards still need verification.

## Solo-developer tax decision

Being a solo developer does not by itself determine sales-tax obligations. Assuming a Canadian business, establish whether you are operating as a sole proprietor or corporation, whether already registered, the relevant taxable revenue, and customer locations before setting collection rules.

For most businesses, CRA's small-supplier rules use a CAD 30,000 threshold measured in a single calendar quarter or across four consecutive quarters. For a sole proprietor, the calculation includes relevant worldwide taxable revenue from all businesses and associates, before expenses. Registration timing differs by how the threshold is crossed. Voluntary registration also matters. [CRA registration guidance](https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/when-register-charge.html).

Do not equate this with profit, only this app's revenue, or an exemption because customers provide health care. Confirm the tax treatment of the software sale and any applicable provincial obligations. Record the decision and effective date; configure and test billing to match it. A setting named `none` only configures the software; it does not establish a legal exemption. Income-tax reporting is a separate question.

## Free help for privacy documents

Start with the free [Office of the Privacy Commissioner business guide](https://www.priv.gc.ca/en/privacy-topics/privacy-laws-in-canada/the-personal-information-protection-and-electronic-documents-act-pipeda/pipeda-compliance-help/guide_org/) and [security self-assessment tool](https://services.priv.gc.ca/securite-security/en). They help identify the operating decisions a privacy policy should describe.

Use the existing drafts after recording actual data collection, purposes, access, provider locations, retention, deletion and incident procedures. A generator can help with wording but cannot finalize those facts or validate an agency-specific agreement. Obtain focused review of the settled documents where needed. The separate compliance chat covers jurisdiction, document scope and affordable review options.
