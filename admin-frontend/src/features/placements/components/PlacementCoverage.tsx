import {
  WEEKDAY_LABELS,
  SERVICE_TYPE_LABELS,
} from '@/features/authorizations/constants'
import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { format } from 'date-fns'
import {
  usePlacement,
  useApproveCareSlots,
  useClosePlacement,
} from '../hooks/usePlacements'
import type { ApprovalReview } from '../api'
import { useUnsavedChanges } from '@/features/attention/hooks/useUnsavedChanges'
import { errorMessage } from '@/features/clients/lib/care'

const control = 'border border-ink bg-paper px-3 py-2 text-sm'
function message(error: unknown) {
  return errorMessage(error)
}

// Layer 3: coordinates data, selected Care Slots and the approval review.
export function PlacementCoverage({
  placementId,
  embedded = false,
}: {
  placementId: string
  embedded?: boolean
}) {
  const query = usePlacement(placementId)
  const { review, approve } = useApproveCareSlots(placementId)
  const close = useClosePlacement()
  const [selected, setSelected] = useState<Record<string, string>>({})
  const [startsOn, setStartsOn] = useState('')
  const [preview, setPreview] = useState<ApprovalReview | null>(null)
  const [acceptGaps, setAcceptGaps] = useState(false)
  const [error, setError] = useState('')
  const [closing, setClosing] = useState(false)
  useUnsavedChanges(Object.values(selected).some(Boolean) && !approve.isPending)
  if (query.isPending)
    return (
      <p role="status" className="p-8">
        Loading placement…
      </p>
    )
  if (query.isError || !query.data)
    return (
      <p role="alert" className="p-8">
        Could not load placement.{' '}
        <button onClick={() => void query.refetch()}>Retry</button>
      </p>
    )
  const p = query.data
  const today = format(new Date(), 'yyyy-MM-dd')
  const earliestDate = [today, p.start_date ?? '', p.scheduled_from ?? '']
    .sort()
    .at(-1)!
  const effectiveDate = startsOn || earliestDate
  const selections = Object.entries(selected)
    .filter(([, worker]) => worker)
    .map(([care_slot_id, employment_id]) => ({ care_slot_id, employment_id }))
  const busy = review.isPending || approve.isPending
  function resetReview() {
    setPreview(null)
    setAcceptGaps(false)
    setError('')
  }
  async function handleReview() {
    setError('')
    try {
      setPreview(
        await review.mutateAsync({ selections, starts_on: effectiveDate }),
      )
      setAcceptGaps(false)
    } catch (err) {
      setError(message(err))
    }
  }
  async function handleApproval() {
    if (!preview) return
    setError('')
    try {
      await approve.mutateAsync({
        selections,
        starts_on: effectiveDate,
        review_token: preview.review_token,
        accept_uncovered: acceptGaps,
      })
      setSelected({})
      setPreview(null)
      setAcceptGaps(false)
    } catch (err) {
      setError(message(err))
      setPreview(null)
    }
  }
  return (
    <div className="p-8 max-md:p-4 space-y-6">
      {!embedded && (
        <Link
          to="/dashboard/placements"
          className="font-mono text-xs underline"
        >
          ← Placements
        </Link>
      )}
      <header>
        <p className="font-mono text-xs uppercase tracking-widest">
          Weekly Care Need ·{' '}
          {p.status === 'closed'
            ? 'Closed'
            : p.status === 'filled'
              ? 'Fully covered'
              : p.covered_count
                ? 'Partially covered'
                : 'Open'}
        </p>
        <h1 className="font-serif text-4xl mt-3">
          {p.client_first_name} {p.client_last_name}
        </h1>
        <p className="mt-2 text-sm">{p.masked_location}</p>
        <p className="mt-2 font-mono text-xs">
          {p.covered_count} of {p.care_slots.length} Care Slots covered ·
          Proposed start {p.start_date}
          {p.scheduled_from ? ` · Scheduled from ${p.scheduled_from}` : ''}
        </p>
      </header>
      {!p.weekly_care_need_id && (
        <p className="border border-orange p-4">
          This earlier placement has no revision-linked Care Slots.{' '}
          <Link
            to="/dashboard/clients/$clientId/care-need"
            params={{ clientId: p.client_id }}
            className="underline"
          >
            Post the client's Weekly Care Need
          </Link>{' '}
          to use individual approvals.
        </p>
      )}
      {p.requirements && <p className="text-sm">{p.requirements}</p>}
      <section className="border border-ink bg-paper divide-y divide-line-soft">
        {p.care_slots.map((slot, index) => {
          const interested = p.interests.filter((worker) =>
            worker.care_slot_ids.includes(slot.id),
          )
          return (
            <div
              key={slot.id || index}
              className="p-5 flex flex-wrap items-center justify-between gap-4"
            >
              <div>
                <h2 className="font-medium">
                  {WEEKDAY_LABELS[slot.day_of_week]} ·{' '}
                  {slot.start_time.slice(0, 5)}–{slot.end_time.slice(0, 5)}
                </h2>
                <p className="text-sm text-ink-soft">
                  {SERVICE_TYPE_LABELS[slot.service_type]}
                </p>
              </div>
              {slot.worker_id ? (
                <span className="bg-mint-soft px-3 py-2 text-sm">
                  Approved · {slot.worker_name}
                </span>
              ) : p.status === 'open' && p.weekly_care_need_id ? (
                <label className="text-sm">
                  {interested.length} interested
                  <select
                    className={`${control} ml-3`}
                    aria-label={`Worker for ${WEEKDAY_LABELS[slot.day_of_week]} ${slot.start_time}`}
                    disabled={busy}
                    value={selected[slot.id] ?? ''}
                    onChange={(e) => {
                      setSelected((prev) => ({
                        ...prev,
                        [slot.id]: e.target.value,
                      }))
                      resetReview()
                    }}
                  >
                    <option value="">Leave uncovered</option>
                    {interested.map((worker) => (
                      <option
                        key={worker.employment_id}
                        value={worker.employment_id}
                      >
                        {worker.first_name} {worker.last_name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <span>Uncovered</span>
              )}
            </div>
          )
        })}
      </section>
      {p.interests.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm">Worker notes</summary>
          {p.interests.map((w) => (
            <p key={w.employment_id} className="mt-2 text-sm">
              <strong>
                {w.first_name} {w.last_name}
              </strong>
              : {w.note || 'No note provided'}
            </p>
          ))}
        </details>
      )}
      {p.status === 'open' && p.weekly_care_need_id && (
        <div className="flex flex-wrap gap-4 items-end">
          <label className="text-sm">
            Approved coverage starts
            <input
              className={`${control} block mt-1`}
              type="date"
              min={earliestDate}
              value={effectiveDate}
              disabled={busy}
              onChange={(e) => {
                setStartsOn(e.target.value)
                resetReview()
              }}
            />
          </label>
          <button
            className="rounded-full bg-ink text-cream px-5 py-3 text-sm disabled:opacity-40"
            disabled={busy || selections.length === 0}
            onClick={() => void handleReview()}
          >
            {review.isPending ? 'Checking…' : 'Review approval'}
          </button>
        </div>
      )}
      {preview && (
        <section
          aria-label="Schedule change review"
          className="border border-ink bg-paper p-6 space-y-4"
        >
          <h2 className="font-serif text-2xl">
            Review schedule change · {preview.starts_on}
          </h2>
          {preview.ends_previous_schedule && (
            <div className="bg-orange-soft border border-orange p-4">
              <p className="font-semibold">
                All future shifts from the previous Weekly Care Need end from
                this date.
              </p>
              <p className="text-sm mt-2">
                The old schedule will not continue to cover unfilled new Care
                Slots. Earlier visits remain in history.
              </p>
              <ul className="text-sm mt-2">
                {preview.old_shifts.map((s) => (
                  <li key={s.shift_id}>
                    {s.worker_name} · {s.description}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {preview.workers.map((worker) => (
            <div key={worker.worker_id}>
              <p className="font-medium">
                {worker.worker_name} ·{' '}
                {worker.eligibility.all_clear
                  ? 'Checks passed'
                  : 'Needs review'}
              </p>
              {worker.eligibility.reasons.map((reason) => (
                <p key={reason} className="text-orange text-sm">
                  {reason}
                </p>
              ))}
            </div>
          ))}
          {preview.uncovered_slots.length > 0 && (
            <div>
              <p className="font-medium">Still uncovered</p>
              <ul>
                {preview.uncovered_slots.map((slot) => (
                  <li key={slot.id}>
                    {WEEKDAY_LABELS[slot.day_of_week]} ·{' '}
                    {slot.start_time.slice(0, 5)}–{slot.end_time.slice(0, 5)}
                  </li>
                ))}
              </ul>
              <label className="flex items-start gap-3 mt-4 text-sm">
                <input
                  type="checkbox"
                  checked={acceptGaps}
                  onChange={(e) => setAcceptGaps(e.target.checked)}
                />
                I understand these Care Slots remain uncovered and open for
                worker interest.
              </label>
            </div>
          )}
          <button
            className="rounded-full bg-ink text-cream px-5 py-3 text-sm disabled:opacity-40"
            disabled={
              busy ||
              !preview.all_clear ||
              (preview.uncovered_slots.length > 0 && !acceptGaps)
            }
            onClick={() => void handleApproval()}
          >
            {approve.isPending ? 'Scheduling…' : 'Approve and schedule'}
          </button>
        </section>
      )}
      {error && (
        <p role="alert" className="text-orange">
          {error}
        </p>
      )}
      {p.status === 'open' && (
        <div>
          {closing ? (
            <>
              <p className="text-sm">
                Close this placement to new interest? Already approved shifts
                remain scheduled.
              </p>
              <button
                className={`${control} mt-2`}
                disabled={close.isPending}
                onClick={() =>
                  close.mutate(p.id, {
                    onSuccess: () => setClosing(false),
                    onError: (err) => setError(message(err)),
                  })
                }
              >
                Close placement
              </button>
              <button
                className="ml-3 underline"
                onClick={() => setClosing(false)}
              >
                Keep open
              </button>
            </>
          ) : (
            <button
              className="text-sm underline"
              onClick={() => setClosing(true)}
            >
              Close placement
            </button>
          )}
        </div>
      )}
    </div>
  )
}
