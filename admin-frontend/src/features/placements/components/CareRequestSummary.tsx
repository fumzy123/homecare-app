import type { PlacementDetail } from '../api'
import { weeklyHours } from '@/features/clients/lib/care'
import { requestDate, requestNotes } from '../lib/careRequests'

// Layer 2: the posted snapshot, kept separate from the draft coverage plan.
export function CareRequestSummary({
  request: p,
  today,
}: {
  request: PlacementDetail
  today: string
}) {
  const notes = requestNotes(p.requirements)
  const reached =
    p.status === 'open' &&
    !p.scheduled_from &&
    p.start_date &&
    p.start_date <= today
  return (
    <section className="cr-summary" aria-label="Posted request summary">
      <dl className="cr-summary-facts">
        <div>
          <dt className="cr-label">Requested start</dt>
          <dd>{requestDate(p.start_date)}</dd>
          {reached && (
            <dd className="cr-small cr-overdue">Start date reached</dd>
          )}
        </div>
        <div>
          <dt className="cr-label">Weekly care</dt>
          {p.care_slots.length ? (
            <>
              <dd>
                {weeklyHours(p.care_slots)} hours{' '}
                <span className="cr-small">/ week</span>
              </dd>
              <dd className="cr-small">{p.care_slots.length} Care Slots</dd>
            </>
          ) : (
            <dd>See request details</dd>
          )}
        </div>
        <div>
          <dt className="cr-label">Scheduling</dt>
          <dd>
            {p.scheduled_from ? requestDate(p.scheduled_from) : 'Not scheduled'}
          </dd>
          <dd className="cr-small">
            {p.scheduled_from
              ? 'Coverage starts'
              : 'Visits begin after approval'}
          </dd>
        </div>
        <div>
          <dt className="cr-label">Posted</dt>
          <dd>{requestDate(p.created_at)}</dd>
        </div>
      </dl>
      {reached && (
        <p className="cr-summary-hint">
          Choose when visits should begin under Coverage starts below.
        </p>
      )}
      <details className="cr-details">
        <summary>Request details</summary>
        <div className="cr-details-body cr-note-columns">
          {notes.care && (
            <div>
              <h2 className="cr-label">Care &amp; requirements</h2>
              <p>{notes.care}</p>
            </div>
          )}
          {notes.additional && (
            <div>
              <h2 className="cr-label">Additional notes</h2>
              <p>{notes.additional}</p>
            </div>
          )}
          {!p.requirements && (
            <p className="cr-muted">
              No care requirements or additional notes were included.
            </p>
          )}
          {!p.weekly_care_need_id && p.shift_description && (
            <div>
              <h2 className="cr-label">Requested visits</h2>
              <p>{p.shift_description}</p>
            </div>
          )}
        </div>
      </details>
    </section>
  )
}
