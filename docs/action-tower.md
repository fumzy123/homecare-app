# Unified Action Tower

The admin's outstanding work and incoming updates now share one experience. The notification bell is removed from the admin shell. Worker/mobile notification delivery remains in place.

## How it works

1. The backend reads care coverage, visits, credentials, funding and overtime records to determine what still needs attention.
2. Each situation has a stable identity. A care revision keeps the same Tower card as it is posted, receives interest and is partially covered. Individual interested workers and their requested slots appear together on that card.
3. Incoming notifications are linked to those situations. Each admin has their own seen status. Reading an update never resolves the underlying work.
4. Successful business actions write a completed-action entry in the same database transaction as the change. Failed actions leave neither a false accomplishment nor a partially approved request.
5. The Tower refreshes after relevant actions, on window focus and through periodic refresh. Changes from other admins are picked up by polling; this is not a WebSocket implementation.
6. Recent activity retains updates and completed actions. The sidebar Activity page defaults to your completed actions today, using the agency timezone. It also supports another date, agency activity and updates.

## Current checks and recorded actions

Tower checks cover weekly care need posting/interest/uncovered slots, dropped visits, active clients without visits in the selected week, document verification/expiry, funding renewal, overtime and owner-only billing alerts. Waiting work stays in its category. Read informational profile updates leave the work view but remain in history.

Recorded actions include saving care revisions, posting/closing placements, approving slots (including partial coverage), creating/editing/cancelling visits, deciding overtime, verifying documents, adding/amending/cancelling funding authorizations, creating/updating client and worker profiles, sending invitations, saving progress notes and resolving billing payment alerts. This is an operational activity record, not an exhaustive audit log of every database change. Historical accomplishments are not fabricated from old notifications.

## Backend structure

- Router → Service → Repository remains the request path.
- `activity_events` stores completed actions with agency, actor, situation, timestamp and navigation target. Note content and full care profiles are not copied into this feed.
- `activity_reads` stores per-admin event read status. Existing notification history and `notification_reads` are retained.
- `notifications.situation_key` connects incoming updates to the relevant workflow.
- `overtime_requests` stores pending/approved/rejected decisions independently of notification read status. Existing request identifiers remain compatible with the old API contract.
- Overtime approval locks the agency and request, rechecks scheduling, saves the visit/change and decision together, then commits. Existing schedule changes also compare a snapshot so a manager cannot silently approve a stale change. Duplicate pending submissions from the same requester are deduplicated. A second decision returns a conflict.
- Data queries enforce agency and role visibility. Billing activity is owner-only. New tables have RLS enabled and direct anon/authenticated Data API access revoked; the backend database role supplies access.

## Endpoints

- `GET /api/attention-items`: current situations, workers/slots, progress and unread counts.
- `GET /api/activity`: keyset-paginated history; scope, agency-local day, situation and entry-kind filters.
- `PATCH /api/activity/read`: marks only explicitly supplied, visible event/notification IDs as seen; available in billing read-only mode.
- `GET /api/shifts/overtime-requests/{notification_id}` and existing request/approve/reject routes: dedicated request workflow.

## Rollout

Apply Alembic migration `e02d964f8383` before starting the updated backend, then deploy the admin frontend. Run `alembic upgrade head` against the intended environment through the normal release process. The existing schema head must be `5961f453498d` (or allow Alembic to apply the preceding migrations).

The migration links legacy notifications where their data supports it, preserves read rows, and imports pending overtime requests. Previously resolved requests with unknown outcomes are marked `reviewed`, not invented approvals. Legacy requests without complete visit context remain readable and can be rejected/resubmitted; new requests require client and visit times.

No hosted database or deployment was changed during implementation. Validation used an isolated local PostgreSQL database. The new migration was exercised transactionally against predecessor-shaped tables with legacy records; an empty-database replay of all older migrations requires the project's Supabase storage schema.

## Verification

- Backend suite: 574 tests passed with PostgreSQL integration tests enabled.
- Tests cover agency/role isolation, per-admin read status, read-versus-done separation, local-day filtering, pagination, multiple interested workers, partial coverage, legacy migration, worker notification preservation, overtime approval/rejection, existing-visit edits, stale review rejection and rollback on failure.
- Frontend typecheck, focused lint and production build passed. The existing large-bundle warning remains.
- Browser checks exercise actual production Tower/Activity components in `admin-frontend/tests/action-tower.html` with an isolated in-memory API adapter. This host has sample data and makes no business API calls. It is not part of the production build.
