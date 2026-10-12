import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useUnsavedChanges } from '@/features/attention/hooks/useUnsavedChanges'
import { errorMessage } from '@/features/clients/lib/care'
import { useAssignments, useEndAssignments } from '../hooks/useAssignments'
import type { Assignment, EndReview } from '../api'
import { AssignmentList } from './AssignmentList'
import { EndAssignmentDialog } from './EndAssignmentDialog'
import '@/features/clients/client-workspace.css'

// Layer 3: shared coordinator, used by both profile entry points.
export function AssignmentsPanel({ workerId, clientId }: { workerId?: string; clientId?: string }) {
  const query = useAssignments({ worker_id: workerId, client_id: clientId })
  const { review, end } = useEndAssignments()
  const [managing, setManaging] = useState<Assignment[] | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [stopsFrom, setStopsFrom] = useState('')
  const [reason, setReason] = useState('')
  const [preview, setPreview] = useState<EndReview | null>(null)
  const [error, setError] = useState('')
  const [replacementId, setReplacementId] = useState('')
  const [history, setHistory] = useState(false)
  const busy = review.isPending || end.isPending
  useUnsavedChanges(Boolean(managing && (selected.length || reason)) && !end.isPending)
  function manage(rows: Assignment[]) {
    setManaging(rows); setSelected([]); setReason(''); setStopsFrom(query.data?.today || '')
    setPreview(null); setError(''); setReplacementId('')
  }
  const minDate = [query.data?.today || '', ...(managing || []).filter(a => selected.includes(a.id)).map(a => a.starts_on)].sort().at(-1) || ''
  async function submit(confirm: boolean) {
    setError('')
    const payload = { assignment_ids: selected, stops_from: stopsFrom, reason: reason.trim() }
    try {
      if (confirm && preview) {
        const result = await end.mutateAsync({ ...payload, review_token: preview.review_token })
        setManaging(null); setPreview(null); setReplacementId(result.placement_id)
      } else setPreview(await review.mutateAsync(payload))
    } catch (err) {
      setError(errorMessage(err)); setPreview(null)
    }
  }
  const rows = query.data?.assignments || []
  const visible = rows.filter(a => history || a.status !== 'ended')
  return <section className="client-workspace p-6" aria-label="Assignments">
    <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
      <div><h2 className="text-xl font-semibold">Assignments</h2><p className="text-sm text-ink-soft mt-1">Approved recurring care slots and their history.</p></div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={history} onChange={e => setHistory(e.target.checked)} />Show ended assignments</label>
    </div>
    {replacementId && <div role="status" className="border border-line rounded-lg p-4 mb-4">
      Selected assignments ended. Past care records are preserved.{' '}
      <Link className="underline" to="/dashboard/placements/$placementId" params={{ placementId: replacementId }}>Find replacement coverage</Link>
    </div>}
    {query.isPending ? <p role="status">Loading assignments…</p> : query.isError ? <p role="alert">Could not load assignments. <button className="underline" onClick={() => void query.refetch()}>Retry</button></p>
      : visible.length ? <AssignmentList rows={visible} workerView={Boolean(workerId)} onManage={manage} />
      : <p className="text-sm text-ink-soft">No {history ? '' : 'current '}care-slot assignments. Individually scheduled visits and imported schedules remain in visit history.</p>}
    {managing && <EndAssignmentDialog rows={managing} selected={selected} stopsFrom={stopsFrom} reason={reason} minDate={minDate}
      preview={preview} busy={busy} error={error}
      onSelect={id => { setSelected(ids => ids.includes(id) ? ids.filter(i => i !== id) : [...ids, id]); setPreview(null) }}
      onDate={setStopsFrom} onReason={setReason} onReview={() => void submit(false)} onConfirm={() => void submit(true)}
      onBack={() => setPreview(null)} onClose={() => { if (!busy) setManaging(null) }} />}
  </section>
}
