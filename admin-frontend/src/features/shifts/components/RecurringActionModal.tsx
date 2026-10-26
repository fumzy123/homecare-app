import { useState } from 'react'
import { VisitDrawer } from './VisitDrawerUI'

export type RecurringScope = 'this' | 'following' | 'all'
interface RecurringActionModalProps {
  mode: 'delete' | 'edit'
  onConfirm: (scope: RecurringScope) => void
  onCancel: () => void
  recurrenceRuleChanged?: boolean
  busy?: boolean
  occurrenceLabel?: string
}
const OPTIONS: { value: RecurringScope; label: string; sub: string }[] = [
  { value: 'this', label: 'This visit only', sub: 'Change this occurrence. Keep the recurring schedule unchanged.' },
  { value: 'following', label: 'This and following visits', sub: 'Change this occurrence and later visits. Keep earlier visits unchanged.' },
  { value: 'all', label: 'All visits in this series', sub: 'Apply the change to the recurring series, including earlier eligible visits.' },
]
export function RecurringActionModal({ mode, onConfirm, onCancel, recurrenceRuleChanged = false, busy = false, occurrenceLabel }: RecurringActionModalProps) {
  const [selected, setSelected] = useState<RecurringScope>(recurrenceRuleChanged ? 'all' : 'this')
  return (
    <VisitDrawer compact title={mode === 'delete' ? 'Delete visits' : 'Save changes'}
      subtitle={occurrenceLabel ? `Selected visit: ${occurrenceLabel}` : 'Choose which visits this change applies to.'} onClose={onCancel} busy={busy}>
      <div className="vd-body">
        {recurrenceRuleChanged && <p className="vd-notice">You changed the repeat pattern. Choose this and following visits or the whole series.</p>}
        <div className="space-y-3" role="group" aria-label="Visits to change">
          {OPTIONS.map(({ value, label, sub }) => (
            <button key={value} type="button" className="vd-scope-option" aria-pressed={selected === value}
              disabled={busy || (recurrenceRuleChanged && value === 'this')} onClick={() => setSelected(value)}>
              <strong>{label}</strong><span>{recurrenceRuleChanged && value === 'this' ? 'Unavailable when the repeat pattern changes.' : mode === 'delete' ? `Delete ${value === 'this' ? 'only this occurrence.' : value === 'following' ? 'this occurrence and later visits.' : 'the recurring series.'}` : sub}</span>
            </button>
          ))}
        </div>
        <p className="vd-help">{mode === 'delete' ? 'Review the selected visits before confirming deletion.' : selected === 'this' ? 'Worker, client, location and repeat settings stay unchanged for a single-visit edit.' : 'Scheduling checks still run before any changes are saved.'}</p>
      </div>
      <footer className="vd-footer">
        <button type="button" disabled={busy} onClick={onCancel} className="vd-btn">Cancel</button>
        <button type="button" disabled={busy} onClick={() => onConfirm(selected)} className={`vd-btn ${mode === 'delete' ? 'vd-btn-danger' : 'vd-btn-primary'}`}>{busy ? 'Saving…' : mode === 'delete' ? 'Delete' : 'Save'}</button>
      </footer>
    </VisitDrawer>
  )
}
