import { ArrowLeft, ArrowRight, Check, TriangleAlert } from 'lucide-react'
import { useEffect, useRef } from 'react'
import {
  WEEKDAY_LABELS,
  SERVICE_TYPE_LABELS,
} from '@/features/authorizations/constants'
import type { ApprovalReview, PlacementDetail, ApprovalPayload } from '../api'
import { requestDate } from '../lib/careRequests'

// Layer 2: shows the server's review, never invents eligibility or funding results.
export function CareRequestReview({
  request: p,
  preview,
  selections,
  busy,
  acceptGaps,
  stale,
  error,
  onAcceptGaps,
  onBack,
  onApprove,
}: {
  request: PlacementDetail
  preview: ApprovalReview
  selections: ApprovalPayload['selections']
  busy: boolean
  acceptGaps: boolean
  stale: boolean
  error: string
  onAcceptGaps: (value: boolean) => void
  onBack: () => void
  onApprove: () => void
}) {
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    heading.current?.focus()
    heading.current?.scrollIntoView({ block: 'start' })
  }, [])
  return (
    <section className="cr-review" aria-label="Schedule change review">
      <button className="cr-link cr-back" disabled={busy} onClick={onBack}>
        <ArrowLeft size={16} /> Back to coverage
      </button>
      <p className="cr-label">
        {p.client_first_name} {p.client_last_name} / Approval
      </p>
      <h1 ref={heading} tabIndex={-1}>
        Review the <em>change.</em>
      </h1>
      <p className="cr-muted">
        Coverage starts {requestDate(preview.starts_on)}
      </p>
      <div className="cr-review-box">
        <p className="cr-label">New recurring coverage</p>
        {selections.map((s) => {
          const slot = p.care_slots.find((slot) => slot.id === s.care_slot_id)
          const worker = p.interests.find(
            (w) => w.employment_id === s.employment_id,
          )
          return (
            slot && (
              <div className="cr-review-row" key={s.care_slot_id}>
                <div>
                  {WEEKDAY_LABELS[slot.day_of_week]} ·{' '}
                  {slot.start_time.slice(0, 5)}–{slot.end_time.slice(0, 5)}
                  <p className="cr-small">
                    {SERVICE_TYPE_LABELS[slot.service_type]}
                  </p>
                </div>
                <span>
                  {worker?.first_name} {worker?.last_name}
                </span>
              </div>
            )
          )
        })}
      </div>
      {preview.ends_previous_schedule && (
        <div className="cr-callout">
          <h3>The previous schedule ends.</h3>
          <p className="mt-3">
            From {requestDate(preview.starts_on)}, the previous revision’s
            recurring visits stop. They will not cover unfilled Care Slots in
            this revision. Earlier visits remain in history.
          </p>
          <details className="mt-4">
            <summary>See affected coverage</summary>
            <ul className="mt-3">
              {preview.old_shifts.map((s) => (
                <li key={s.shift_id}>
                  {s.worker_name} · {s.description}
                </li>
              ))}
            </ul>
          </details>
        </div>
      )}
      <div className="cr-review-box">
        <p className="cr-label">Eligibility checks</p>
        {preview.workers.map((w) => (
          <div className="cr-review-row" key={w.worker_id}>
            <div>
              <p>{w.worker_name}</p>
              {w.eligibility.reasons.map((reason) => (
                <p className="cr-error" key={reason}>
                  {reason}
                </p>
              ))}
            </div>
            <span className="cr-row">
              {w.eligibility.all_clear ? (
                <Check size={16} />
              ) : (
                <TriangleAlert size={16} />
              )}
              {w.eligibility.all_clear ? 'Checks passed' : 'Needs review'}
            </span>
          </div>
        ))}
        {!preview.all_clear && (
          <p className="cr-error">
            Resolve the reported issues before approving this coverage.
          </p>
        )}
      </div>
      {preview.uncovered_slots.length > 0 && (
        <div className="cr-review-box">
          <h3>
            {preview.uncovered_slots.length} Care Slot
            {preview.uncovered_slots.length === 1
              ? ' remains'
              : 's remain'}{' '}
            open.
          </h3>
          {preview.uncovered_slots.map((slot) => (
            <div className="cr-review-row" key={slot.id}>
              <span>
                {WEEKDAY_LABELS[slot.day_of_week]} ·{' '}
                {slot.start_time.slice(0, 5)}–{slot.end_time.slice(0, 5)}
              </span>
              <span className="cr-small">
                {SERVICE_TYPE_LABELS[slot.service_type]}
              </span>
            </div>
          ))}
          <label className="cr-check">
            <input
              type="checkbox"
              checked={acceptGaps}
              disabled={busy}
              onChange={(e) => onAcceptGaps(e.target.checked)}
            />
            I understand these Care Slots remain uncovered and open for worker
            interest.
          </label>
        </div>
      )}
      {stale && (
        <p role="alert" className="cr-error">
          This request changed. Go back and review the latest coverage before
          approving.
        </p>
      )}
      {error && (
        <p role="alert" className="cr-error">
          {error}
        </p>
      )}
      <div className="cr-between cr-review-footer">
        <p className="cr-small">
          Eligibility is checked again at confirmation.
        </p>
        <button
          className="cr-button cr-primary"
          disabled={
            busy ||
            stale ||
            !preview.all_clear ||
            (preview.uncovered_slots.length > 0 && !acceptGaps)
          }
          onClick={onApprove}
        >
          {busy ? 'Scheduling…' : 'Approve and schedule'}{' '}
          <ArrowRight size={16} />
        </button>
      </div>
    </section>
  )
}
