import type { Placement } from '../api'
import { requestStatus, sortCareSlots } from '../lib/careRequests'
import '../care-requests.css'

// Layer 2: controlled request status and segmented coverage display.
export function RequestStatus({ request }: { request: Placement }) {
  return (
    <span
      className={`cr-badge ${request.status === 'filled' ? 'cr-mint' : ''}`}
    >
      {requestStatus(request)}
    </span>
  )
}
export function RequestCoverage({ request }: { request: Placement }) {
  if (!request.weekly_care_need_id || !request.care_slots.length)
    return <span className="cr-muted">Legacy record</span>
  const total = request.care_slots.length
  return (
    <div
      className="cr-coverage"
      role="img"
      aria-label={`${request.covered_count} of ${total} Care Slots covered`}
    >
      <span className="cr-number" aria-hidden="true">
        {request.covered_count} / {total}
      </span>
      <div className="cr-segments" aria-hidden="true">
        {sortCareSlots(request.care_slots).map((slot) => (
          <span key={slot.id} className={slot.worker_id ? 'cr-covered' : ''} />
        ))}
      </div>
    </div>
  )
}
