import { useState } from 'react'
import { shiftsApi, type ShiftOccurrence } from '../api'
import { useShiftDetailWorkers, useShiftDetailWrite } from '../hooks/useShiftDetail'

// Layer 3: occurrence-only replacement, with explicit arrangement confirmation.
export function ArrangeVisitCover({ shift, onDone }: { shift: ShiftOccurrence; onDone: () => void }) {
  const { data: workers = [], isLoading } = useShiftDetailWorkers(true)
  const [worker, setWorker] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const save = useShiftDetailWrite({ onSuccess: onDone })
  return <section className="border border-ink p-4 bg-yellow-50">
    <h3 className="font-serif text-xl">Needs replacement</h3>
    <p>{shift.dropped_reason?.startsWith('Worker on leave') ? 'The original worker is on leave.' : 'This visit was dropped.'} Arrange cover for this visit only.</p>
    <fieldset disabled={save.isPending} className="space-y-3 mt-3">
      <label className="block">Replacement worker
        <select className="block border border-ink p-2 w-full" value={worker} onChange={e => { setWorker(e.target.value); setConfirmed(false) }}>
          <option value="">{isLoading ? 'Loading workers…' : 'Choose replacement worker'}</option>
          {workers.map(w => <option key={w.id} value={w.id}>{w.first_name} {w.last_name}</option>)}
        </select>
      </label>
      <label className="block"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} /> I have arranged this visit with the selected worker.</label>
      {save.isError && <p role="alert">{save.error.message}</p>}
      <button className="border border-ink p-2" disabled={!worker || !confirmed || save.isPending}
        onClick={() => save.mutate(() => shiftsApi.replaceDroppedVisit(shift.shift_id, shift.date, worker))}>
        {save.isPending ? 'Saving…' : 'Confirm replacement'}
      </button>
    </fieldset>
  </section>
}
