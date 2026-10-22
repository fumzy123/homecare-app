import { ArrowRight, Check } from 'lucide-react'
import {
  WEEKDAY_LABELS,
} from '@/features/weekly-care-need/constants'
import { slotHours } from '@/features/clients/lib/care'
import type { PlacementDetail } from '../api'

type RequestProps = {
  request: PlacementDetail
  selected: Record<string, string>
  busy: boolean
}
// Layer 2: controlled work surfaces; the coordinator owns mutations and selection.
export function CareRequestSlots({
  request: p,
  selected,
  busy,
  onSelect,
  workers,
  workersLoading,
  workersError,
  onRetryWorkers,
}: RequestProps & {
  onSelect: (slot: string, worker: string) => void
  workers: {
    id: string
    first_name: string
    last_name: string
    max_hours_per_week: number | null
  }[]
  workersLoading: boolean
  workersError: boolean
  onRetryWorkers: () => void
}) {
  return (
    <section>
      <p className="cr-muted">
        {p.status === 'open'
          ? 'Choose a worker for each open Care Slot. Scheduling checks run when you review.'
          : 'Approved workers and remaining Care Slots.'}
      </p>
      {p.status === 'open' && p.weekly_care_need_id && (
        <>
          {workersLoading && <p role="status">Loading agency workers…</p>}
          {workersError && (
            <p role="alert">
              Could not refresh agency workers.{' '}
              <button
                className="cr-link"
                disabled={busy}
                onClick={onRetryWorkers}
              >
                Retry workers
              </button>
            </p>
          )}
        </>
      )}
      <div className="cr-slots">
        {p.care_slots.map((slot) => {
          const interested = p.interests.filter((w) =>
            w.care_slot_ids.includes(slot.id),
          )
          // Keep existing interest usable while the roster loads or fails.
          const candidates = new Map(
            workers.map((w) => [
              w.id,
              { id: w.id, name: `${w.first_name} ${w.last_name}` },
            ]),
          )
          if (workersLoading || workersError)
            for (const w of interested)
              if (!candidates.has(w.employment_id))
                candidates.set(w.employment_id, {
                  id: w.employment_id,
                  name: `${w.first_name} ${w.last_name}`,
                })
          const options = [...candidates.values()].sort((a, b) =>
            a.name.localeCompare(b.name),
          )
          const interestedIds = new Set(interested.map((w) => w.employment_id))
          const interestedOptions = options.filter((w) => interestedIds.has(w.id))
          const otherOptions = options.filter((w) => !interestedIds.has(w.id))
          return (
            <article
              className={`cr-slot ${selected[slot.id] && !slot.worker_id ? 'cr-selected' : ''}`}
              key={slot.id}
            >
              <div className="cr-between">
                <div className="cr-row">
                  <h3>{WEEKDAY_LABELS[slot.day_of_week]}</h3>
                  <span>
                    {slot.start_time.slice(0, 5)}–{slot.end_time.slice(0, 5)}
                  </span>
                </div>
                <span className={`cr-badge ${slot.worker_id ? 'cr-mint' : ''}`}>
                  {slot.worker_id
                    ? 'Approved'
                    : selected[slot.id]
                      ? 'Selected'
                      : 'Uncovered'}
                </span>
              </div>
              <p className="cr-small mt-2">
                {slotHours(slot)}{' '}
                hours / week
              </p>
              <div className="cr-between cr-slot-bottom">
                {slot.worker_id ? (
                  <span className="cr-row">
                    <Check size={16} />
                    {slot.worker_name || 'Assigned worker'}
                    {slot.assignment_source === 'admin_arranged' && (
                      <span className="cr-small"> · Arranged by admin</span>
                    )}
                  </span>
                ) : p.status === 'open' && p.weekly_care_need_id ? (
                  <>
                    <span className="cr-small">
                      {interested.length} interested
                    </span>
                    <select
                      className="cr-select"
                      aria-label={`Worker for ${WEEKDAY_LABELS[slot.day_of_week]} ${slot.start_time}`}
                      disabled={busy}
                      value={selected[slot.id] ?? ''}
                      onChange={(e) => onSelect(slot.id, e.target.value)}
                    >
                      <option value="">Choose worker…</option>
                      {!options.length && (
                        <option disabled>No active workers available</option>
                      )}
                      {interestedOptions.length > 0 && (
                        <optgroup label="Interested in this slot">
                          {interestedOptions.map((w) => (
                            <option key={w.id} value={w.id}>
                              {w.name} · Interested
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {otherOptions.length > 0 && (
                        <optgroup label="Other active workers">
                          {otherOptions.map((w) => (
                            <option key={w.id} value={w.id}>{w.name}</option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  </>
                ) : (
                  <span className="cr-muted">No worker assigned</span>
                )}
              </div>
              {!slot.worker_id && slot.replacement_from && (
                <p className="cr-small mt-3">
                  Previous assignment stops from {slot.replacement_from}. Choose
                  replacement coverage from that date or later.
                </p>
              )}
            </article>
          )
        })}
      </div>
      {p.status === 'open' && (
        <p className="cr-note">
          Selections are a draft until you approve and schedule.
        </p>
      )}
    </section>
  )
}

export function CareRequestWorkers({
  request: p,
  selected,
  busy,
  onSelect,
}: RequestProps & { onSelect: (worker: string) => void }) {
  const open = p.care_slots.filter((s) => !s.worker_id)
  return (
    <div className="cr-people">
      {p.interests.length ? (
        p.interests.map((w) => {
          const slots = p.care_slots.filter((s) =>
            w.care_slot_ids.includes(s.id),
          )
          const available = slots.filter((s) => !s.worker_id)
          const selectable = available.filter((s) => !selected[s.id])
          return (
            <article className="cr-person" key={w.employment_id}>
              <div className="cr-between">
                <div className="cr-row">
                  <span className="cr-avatar" aria-hidden="true">
                    {w.first_name[0]}
                    {w.last_name[0]}
                  </span>
                  <h3>
                    {w.first_name} {w.last_name}
                  </h3>
                </div>
                <span
                  className={`cr-badge ${available.length && available.length === open.length ? 'cr-mint' : ''}`}
                >
                  {available.length && available.length === open.length
                    ? 'All open Care Slots'
                    : `${available.length} open Care Slot${available.length === 1 ? '' : 's'}`}
                </span>
              </div>
              <div className="cr-chips">
                {slots.map((s) => (
                  <span className="cr-chip" key={s.id}>
                    {WEEKDAY_LABELS[s.day_of_week]} · {s.start_time.slice(0, 5)}
                    –{s.end_time.slice(0, 5)}
                    {s.worker_id ? ' · Covered' : ''}
                  </span>
                ))}
              </div>
              {w.note && (
                <p className="cr-muted whitespace-pre-wrap mb-5">{w.note}</p>
              )}
              {p.status === 'open' &&
                p.weekly_care_need_id &&
                available.length > 0 && (
                  <button
                    className="cr-button"
                    disabled={busy || !selectable.length}
                    onClick={() => onSelect(w.employment_id)}
                  >
                    Select for {selectable.length || available.length} Care Slot
                    {(selectable.length || available.length) === 1
                      ? ''
                      : 's'}{' '}
                    <ArrowRight size={16} />
                  </button>
                )}
            </article>
          )
        })
      ) : (
        <div className="cr-empty">
          <h2>No worker interest yet.</h2>
          <p className="cr-muted">
            Workers who respond to this request will appear here. You can also
            assign an agency worker directly from Care coverage.
          </p>
        </div>
      )}
    </div>
  )
}
