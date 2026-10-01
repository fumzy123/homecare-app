import { useState } from 'react'
import { useWorkers } from '@/features/workers/hooks/useWorkers'
import { usePlacementAssignment } from '../hooks/usePlacements'
import type { AssignmentPreview } from '../api'
import { ApiError } from '@/shared/lib/api-client'

const button = 'border border-ink px-4 py-2 text-sm disabled:opacity-40'

export function AssignmentReview({ preview, busy, onConfirm }: { preview: AssignmentPreview; busy: boolean; onConfirm: () => void }) {
  const [confirmed, setConfirmed] = useState(false)
  return <div className="space-y-3">
    <p className="font-semibold">{preview.worker_name}</p>
    {preview.eligibility.all_clear ? <>
      <p>Availability, existing shifts, and weekly hours checks passed. They will be checked again when you assign.</p>
      <label className="flex gap-2 items-start"><input type="checkbox" checked={confirmed} disabled={busy} onChange={e => setConfirmed(e.target.checked)} className="mt-1" />
        <span>I have arranged this assignment with the worker and reviewed the placement’s requirements. Create recurring shifts from the care need saved with this placement.</span>
      </label>
      <button className={button} disabled={busy || !confirmed} onClick={onConfirm}>{busy ? 'Assigning…' : 'Confirm assignment and create shifts'}</button>
    </> : <div role="status"><p>This worker cannot currently cover this placement:</p><ul className="list-disc pl-5">{preview.eligibility.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul></div>}
  </div>
}

export function DirectAssignmentPanel({ placementId, disabled = false }: { placementId: string; disabled?: boolean }) {
  const [worker, setWorker] = useState('')
  const workers = useWorkers()
  const { preview, assign } = usePlacementAssignment(placementId, worker)
  const busy = disabled || assign.isPending
  return <section className="border border-ink bg-paper p-6 mb-8 space-y-4 text-sm">
    <h2 className="font-serif text-2xl">Assign a worker directly</h2>
    <p>Choose a worker after arranging coverage with them. They do not need to express interest in the app first.</p>
    {workers.isPending ? <p>Loading workers…</p> : workers.isError ? <div role="alert"><p>Could not load workers.</p><button className={button} onClick={() => void workers.refetch()}>Retry</button></div> : <label className="block">Worker
      <select className="block border border-ink p-2 mt-2 w-full" value={worker} disabled={busy} onChange={e => { setWorker(e.target.value); assign.reset() }}>
        <option value="">Select a worker</option>
        {workers.data?.map(w => <option key={w.id} value={w.id}>{w.first_name} {w.last_name}</option>)}
      </select>
    </label>}
    {worker && preview.isPending && <p>Checking eligibility…</p>}
    {worker && preview.isError && <div role="alert"><p>{preview.error instanceof ApiError ? preview.error.message : 'Could not check eligibility.'}</p><button className={button} onClick={() => void preview.refetch()}>Recheck</button></div>}
    {worker && preview.data && !preview.isError && !assign.isSuccess && <AssignmentReview key={worker} preview={preview.data} busy={busy || preview.isFetching} onConfirm={() => assign.mutate()} />}
    {assign.isError && <p role="alert">{assign.error instanceof ApiError ? assign.error.message : 'Assignment could not be confirmed. Refresh the placement to check its status before trying again.'}</p>}
    {assign.isSuccess && <p role="status">Worker assigned and recurring shifts created.</p>}
  </section>
}
