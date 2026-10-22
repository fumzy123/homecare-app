# Staging agency walkthrough

Checked October 15, 2026. The agency care workflow passed the live staging checks below after a timesheet date-display correction. This was a combined deployed-browser and authenticated-API acceptance run using fictional clients and disposable agencies. Production and pre-existing staging accounts were not changed.

## Results

| Area | Result and evidence |
| --- | --- |
| Registration and confirmation | Public signup issued no session before confirmation. Resend reported delivery to a unique Gmail alias authorized by the user. The delivered token verified successfully; signup profile and agency timezone survived in metadata, and the confirmed identity created an agency through the application API. |
| Worker invitation | The application sent an invitation to a separate alias. Delivery, token verification, password setup, membership creation and subsequent password sign-in succeeded. Worker profile access succeeded and admin access was denied. |
| Password recovery | Recovery email was delivered. Its token allowed password replacement; the new password worked, the old one failed, and worker profile access remained available. Only the newly created alias was affected. |
| Invitation revocation | A separate disposable invitation was revoked. Another agency could not resend it. |
| Client intake | Completed the deployed three-step browser intake. Required phone validation was exercised; the saved client had the intended birth date, address, emergency contact and fictional care details. |
| Funding | A 12-hour biweekly authorization rejected a proposed 12-hour weekly plan. A 6-hour weekly plan succeeded. |
| Weekly care and posting | Saving and posting created no visits. The same Action Tower case progressed from posting to reviewing worker interest. Three workers expressed interest through authenticated worker APIs. |
| Partial approval | Browser approval assigned Monday and Wednesday to a worker. The review required explicit acknowledgment that Friday remained uncovered. Exactly two assignments were created. |
| Concurrent approval | Two simultaneous requests attempted the same Friday approval against hosted PostgreSQL. One succeeded and one returned 409; exactly three unique slot assignments existed afterward. A deliberately stale review token was also rejected. |
| Conflicts and overtime | A visit overlapping approved recurring coverage was rejected. A 42-hour week was rejected without override; an owner override succeeded and was recorded. Temporary overtime visits were cancelled afterward. |
| Recurring visit edits | Moving one Wednesday occurrence changed that visit while the following Wednesday retained its original time. |
| Assignment replacement | Ending Friday coverage reopened the same request and Action Tower case. Overlapping and late replacement starts were rejected. Replacement began exactly at the cutoff; old assignment reason, actor and history remained. |
| Revision transition | A pending future activation blocked another conflicting revision. On a separate active care plan, saving and posting a revision preserved the current schedule. Approval activated Tuesday coverage, left Saturday open and ended all old Monday, Wednesday and Friday coverage. The unrelated historical visit and notes remained. |
| Care request closure | Closing an open, partially covered request preserved its approved visits. |
| Worker access and agency isolation | Assigned workers could read care-facing client information. Unassigned workers and another agency were denied. Private agency notes were absent from the worker response. |
| Progress notes | Worker note, admin follow-up and worker clarification produced three retained entries. A final follow-up saved through the deployed browser produced a fourth entry and preserved the original three. Stale appends were rejected. Other workers and agencies could not read the note; future worker documentation was rejected. |
| Worker inbox | Assignment, schedule update and cancellation notices were present. Read state persisted and another agency did not receive those notices. This verifies the inbox, not Android phone delivery. |
| Timesheet export | Browser export with worker and completed-status filters contained one row: October 14, 09:00–10:00, 1.00 hour, completed. CSV values were correct. The table initially displayed October 13; the correction below was verified in a newly deployed staging browser. |

## Correction deployed

Commit `0ef354025aac01233528ca135e51d7fa5f2cdc93` changes the timesheet calendar-date formatter to parse a date-only value as a local calendar date. Previously, parsing `2026-10-14` as UTC displayed October 13 in Newfoundland. The CSV already retained the correct date.

A component regression check passed with `TZ=America/St_Johns`; the frontend build and [Frontend CI](https://github.com/fumzy123/homecare-app/actions/runs/38746001303) passed. Browser verification on [the staging preview](https://homecare-ojkitjfci-fumezs-projects.vercel.app) showed October 14 and 1.00 hour. Only the date fix and its test were committed; unrelated working-tree changes were excluded.

Local evidence is retained in ignored `.cache/agency-walkthrough-partial-approval.jpg`, `.cache/agency-walkthrough-timesheet-fixed.jpg`, `.cache/agency-walkthrough-notes.jpg` and the private acceptance state. The exported CSV is `C:/Users/omafu/Downloads/timesheet-2026-10-11-to-2026-10-17.csv`. Private state contains test credentials and must not be committed or shared.

## Scope and remaining release checks

The initial scheduling workers were deliberately seeded fixtures. Registration, invitation and recovery were then exercised separately with real delivered emails and the public Auth/application endpoints. Email confirmation, invitation password entry and recovery password entry were completed through APIs; this does not sign off every browser form or the browser terms-acceptance interaction. A final human pass through those screens remains appropriate before release, especially if the separate in-progress confirmation UI changes are deployed.

Physical Android installation, permission prompts, foreground/background/closed-app push delivery, notification taps, device credential uploads and mobile release signing remain outside this agency-admin run. An actual manager overtime-request inbox workflow and expired-invitation UI were not exercised; the owner override and invitation revocation paths were tested.

Production deployment, production billing configuration and operational onboarding remain separate release gates. The earlier staging billing results are recorded in `staging-billing-acceptance-2026-10-15.md`.

## Test data

Three isolated organizations and their newly created test identities were used: the main workflow agency, a second agency for isolation checks and an email-onboarding agency. Cleanup completed through the application deletion endpoint. Database verification confirmed that all three organizations are inactive and soft-deleted and their associated test Auth identities no longer exist. Historical business rows remain for audit. The separately revoked invitation was removed earlier. No blanket database reset was performed; the user's four existing addresses and pre-existing accounts were preserved.
