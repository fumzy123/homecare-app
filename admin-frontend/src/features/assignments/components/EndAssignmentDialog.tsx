import { ClientDialog } from '@/features/clients/components/ClientWorkspaceUI'
import { slotLabel } from '../lib/labels'
import type { Assignment, EndReview } from '../api'

// Layer 2: all form/review state and requests are owned by AssignmentsPanel.
export function EndAssignmentDialog({ rows, selected, stopsFrom, reason, minDate, preview, busy, error,
  onSelect, onDate, onReason, onReview, onConfirm, onBack, onClose }: {
  rows: Assignment[]; selected: string[]; stopsFrom: string; reason: string; minDate: string
  preview: EndReview | null; busy: boolean; error: string
  onSelect: (id: string) => void; onDate: (value: string) => void; onReason: (value: string) => void
  onReview: () => void; onConfirm: () => void; onBack: () => void; onClose: () => void
}) {
  return <ClientDialog title={preview ? 'Confirm assignment change' : 'Manage assignment'} onClose={onClose}>
    <p className="mb-4"><strong>{rows[0].worker_name}</strong> · {rows[0].client_name}</p>
    {preview ? <>
      <p>Stop these recurring visits from <strong>{preview.stops_from}</strong>, using the agency’s timezone:</p>
      <ul className="my-4 space-y-2">{preview.assignments.map(a => <li key={a.id}>{slotLabel(a)}</li>)}</ul>
      <p className="mb-3">Past visits and progress notes stay on file. Other assignments and employment stay unchanged.</p>
      <p className="mb-3">The client still needs these care slots. The care request reopens for a replacement, and the Action Tower shows the coverage gap.</p>
      <p className="text-sm text-ink-soft">Reason: {reason}</p>
    </> : <>
      <fieldset disabled={busy} className="space-y-3 mb-5">
        <legend className="mb-3 font-semibold">Choose the care slots to end</legend>
        {rows.filter(a => a.can_end).map(a => <label key={a.id} className="flex items-center gap-3">
          <input type="checkbox" checked={selected.includes(a.id)} onChange={() => onSelect(a.id)} />
          {slotLabel(a)}
        </label>)}
      </fieldset>
      <label className="cw-field mb-4">Stop visits from
        <input className="cw-input" type="date" min={minDate} value={stopsFrom} disabled={busy} onChange={e => onDate(e.target.value)} />
        <span className="text-sm text-ink-soft">No visits from this date onward. Dates use the agency’s timezone.</span>
      </label>
      <label className="cw-field mb-4">Reason for the assignment history
        <textarea className="cw-input" rows={3} maxLength={500} value={reason} disabled={busy} onChange={e => onReason(e.target.value)} />
      </label>
      <p className="text-sm text-ink-soft">This ends selected recurring care slots. The worker remains employed.</p>
    </>}
    {error && <p role="alert" className="my-4 text-red-700">{error}</p>}
    <div className="flex flex-wrap justify-end gap-3 mt-6">
      <button className="cw-btn" disabled={busy} onClick={preview ? onBack : onClose}>{preview ? 'Back' : 'Cancel'}</button>
      <button className="cw-btn cw-btn-primary" disabled={busy || !selected.length || !reason.trim() || !stopsFrom || stopsFrom < minDate}
        onClick={preview ? onConfirm : onReview}>{busy ? 'Please wait…' : preview ? 'Confirm and end selected slots' : 'Review change'}</button>
    </div>
  </ClientDialog>
}
