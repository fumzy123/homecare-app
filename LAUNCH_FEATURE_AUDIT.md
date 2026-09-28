# Care Harbor launch feature audit

Reviewed 2026-09-28 on `codex/pricing-billing`. This is a code-path review plus
automated checks, not a claim of end-to-end staging acceptance or store release.
Paths below are relative to the repository root.

| Public promise | Evidence inspected | Assessment / launch condition |
| --- | --- | --- |
| Recurring shifts, calendar/day views | `backend/app/api/routes/shifts.py`, `backend/app/domain/scheduling.py`, `admin-frontend/src/features/shifts/` | Implemented paths. Scheduling domain/service tests exist. Exercise recurring edits and timezone changes in staging. Drag-and-drop was not verified; removed that promise. |
| Conflict checks and overtime review | `backend/app/services/shift_service.py`, overtime request/approve/reject routes in `api/routes/shifts.py` | Implemented checks and owner/manager review. Verify the full request/approval interaction and permissions in staging. |
| Client registry and weekly care plans | `api/routes/clients.py`, `services/weekly_care_plan_service.py`, client feature components | CRUD and care-plan paths present. Run create/edit/archive and authorization-cap workflows with representative agency data. |
| Authorizations and expiry tracking | `services/authorization_service.py`, `AuthorizationsExpiringPanel.tsx` | Upcoming expiry feed covers 15 days. This is a dashboard lookup, not a background reminder. Empty results do not prove every authorization is valid. |
| Worker credentials, attendance, leave | `services/credential_service.py`, worker feature components, leave routes | Office management paths present. Credential dashboard feed covers 30 days. No proof of physical attendance is provided. |
| Progress notes and visit history | `services/progress_note_service.py`, `api/routes/progress_notes.py`, client notes route | Office-admin notes per shift occurrence and client history exist. Field/mobile documentation is excluded from the launch claim. |
| Placements and matching | `api/routes/placements.py`, `services/placement_service.py`, `features/placements/components/DirectAssignmentPanel.tsx` | **Fixed after audit:** explicit office assignment without prior worker interest. Confirmation rechecks eligibility under the existing agency scheduling lock. Generated shifts, placement status and notifications share a transaction. Existing interest-based fill retains its interest requirement. Local regression and UI rendering checks pass; interactive and PostgreSQL concurrency staging checks remain. See `backend/PLACEMENT_ASSIGNMENT.md`. |
| Compliance alerts | Expiry services and dashboard panels; `backend/app/jobs/`; notification enum/service | Dashboard expiry panels exist. No scheduled expiry-notification job was found. Do not promise email, push, or durable expiry reminders. Credential-upload notifications are a different feature. |
| Timesheet CSV | `features/shifts/utils/timesheet.ts`, `TimesheetTable.tsx`, timesheet route | CSV escaping and formula-like text handling tested. Hours come from scheduled times and statuses, not independently verified work. **Fixed after audit:** export now uses the table's filtered/sorted row model and is disabled during pending/refresh/error states. Automated query, row-order, CSV, and rendering checks pass; interactive staging verification remains. |
| Completion / delivered care | `services/shift_completion_service.py`, `jobs/shift_completion.py` | Scheduled visits can be automatically marked completed after their end time. Completed does not mean checked-in, verified, or approved for payroll. |
| Admin in-app notifications | `services/notification_service.py`, `NotificationBell.tsx` | In-app notification paths exist. Trial/payment notices are separately gated by `BILLING_NOTIFICATIONS_ENABLED`. No claim of push delivery. |
| Unlimited worker/staff seats | Versioned billing domain and org-member/invitation services | Pricing uses active clients, not seat counts; no seat-price or explicit seat-cap enforcement found in reviewed services. This is not a load/capacity certification. |
| Onboarding / registry migration | Search of backend and admin code for CSV import/parsers and import endpoints | No reusable registry importer found. Personal onboarding is an operating promise, not implemented import automation. Define accepted formats, field mapping, validation, deduplication, agency isolation, dry-run/reconciliation, and rollback before customer migration. |
| Historical migration and training | No migration pipeline or training-completion workflow found beyond operator onboarding completion | Scope and deliver manually only after agreeing volume/formats. Historical visit/note/attachment import is not verified. Record office training before the operator starts a trial. |
| Mobile / GPS / family portal / client invoicing | Mobile sources and backend routes | Code scaffolding or mobile screens do not establish a published, working product. Keep these out of today's offer; do not promise release dates. Mobile onboarding also contains GPS claims that need review before store release. |

## Corrections made in this step

- Removed public claims of real-time on-site attendance, field note capture,
  payroll/billing-ready hours, drag-and-drop scheduling, and a verified v1 release.
- Added a clear launch-versus-roadmap list, including the need to keep an existing
  client invoicing process and to reconcile scheduled hours before payroll.
- Expiry panels now distinguish loading, failure, and an empty upcoming window.
  They no longer say “all valid” or “no action needed” on an empty/error result.

## Remaining work, in order

1. **Implemented:** matching filtered/sorted timesheet export, scheduled-hours
   notice, and named query hooks. Verify the interaction in staging.
2. **Implemented:** office-led placement assignment, preserving eligibility,
   conflict/overtime checks, agency isolation, frozen care-plan scheduling, and
   transaction safety. Public copy now includes office assignment. Verify the
   interaction and competing scheduling requests in staging before release.
3. Define and verify the operator-led registry import process promised in pricing.
   Agree historical migration limits and reconciliation separately.
4. Decide whether proactive expiry notifications are required for launch. Current
   public copy promises dashboard panels only. If added, implement deduplicated,
   tenant-scoped reminders and renewal/expiry recovery tests.
5. Complete staging acceptance: the workflows above, real PostgreSQL concurrency,
   signed Stripe events, retry/restart, payment authentication, cancellation,
   annual/founding transitions, and interactive browser checks.
6. Finalize/version draft service terms and verify tax, Stripe portal/catalog,
   webhook configuration, migrations, support processes, and rollout switches.

No migrations were applied, no live Stripe settings changed, and no client or
worker records were modified during this audit.
