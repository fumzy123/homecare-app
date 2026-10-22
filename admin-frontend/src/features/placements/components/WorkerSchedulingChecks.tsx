import { Check, TriangleAlert } from 'lucide-react'
import type { ApprovalReview } from '../api'
import { requestDate } from '../lib/careRequests'

// Layer 2: explain the server's checks; never recalculate eligibility in the UI.
export function WorkerSchedulingChecks({
  worker: w,
}: {
  worker: ApprovalReview['workers'][number]
}) {
  const maximum = w.hours?.max_weekly_hours
  const hasMaximum = maximum != null && maximum > 0
  return (
    <section
      className="cr-worker-checks"
      aria-label={`Scheduling checks for ${w.worker_name}`}
    >
      <div className="cr-between">
        <h3>{w.worker_name}</h3>
        <span className="cr-row cr-small">
          {w.eligibility.all_clear ? (
            <Check size={16} aria-hidden="true" />
          ) : (
            <TriangleAlert size={16} aria-hidden="true" />
          )}
          {w.eligibility.all_clear ? 'Checks passed' : 'Needs review'}
        </span>
      </div>
      <dl className="cr-check-explanations">
        <div>
          <dt>Worker availability</dt>
          <dd>
            {w.eligibility.availability_ok
              ? `The selected care slots fit ${w.worker_name}’s recorded availability.`
              : `The selected care slots are not fully covered by ${w.worker_name}’s recorded availability. Review the days and times below.`}
          </dd>
        </div>
        <div>
          <dt>Visit conflicts</dt>
          <dd>
            {w.eligibility.no_conflicts
              ? 'No overlapping visits were found in this worker’s schedule.'
              : 'This worker already has a visit that overlaps the selected care. Review the conflict below.'}
          </dd>
        </div>
        <div>
          <dt>Weekly hours</dt>
          <dd>
            <p>
              {w.eligibility.within_hours
                ? hasMaximum
                  ? `The selected care keeps this worker within their maximum of ${maximum} hours per week and passes the overtime check.`
                  : maximum !== undefined
                    ? 'No personal weekly maximum is set. The selected care passes the overtime check.'
                    : 'The selected care passes the worker’s weekly-hours and overtime checks.'
                : 'The selected care exceeds a weekly-hours limit. Review the maximum-hours or overtime reason below.'}
            </p>
            {!w.eligibility.within_hours && hasMaximum && (
              <p className="cr-small mt-2">
                Worker’s maximum: {maximum} hours per week.
              </p>
            )}
            {w.hours && (
              <details className="cr-hours-detail">
                <summary>View first-week hours</summary>
                <p className="cr-small mt-3">
                  {requestDate(w.hours.week_start)}–
                  {requestDate(w.hours.week_end)}: the week containing this
                  worker’s first new visit. These dates group hours for the
                  weekly limit check.
                </p>
                <dl className="cr-hours-totals">
                  <div>
                    <dt>Already scheduled across clients</dt>
                    <dd>{w.hours.current}h</dd>
                  </div>
                  <div>
                    <dt>Added by this approval</dt>
                    <dd>+ {w.hours.proposed}h</dd>
                  </div>
                  <div>
                    <dt>Total after approval</dt>
                    <dd>{w.hours.total}h</dd>
                  </div>
                </dl>
                <p className="cr-small">
                  This is the first-week breakdown; the scheduling checks also
                  assess later recurring visits.
                </p>
              </details>
            )}
          </dd>
        </div>
      </dl>
      {w.eligibility.reasons.map((reason) => (
        <p className="cr-error" key={reason}>
          {reason}
        </p>
      ))}
    </section>
  )
}
