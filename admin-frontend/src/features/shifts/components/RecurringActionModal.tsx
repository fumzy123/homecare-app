import { useState } from 'react'

export type RecurringScope = 'this' | 'following' | 'all'

interface RecurringActionModalProps {
  mode: 'delete' | 'edit'
  onConfirm: (scope: RecurringScope) => void
  onCancel: () => void
  recurrenceRuleChanged?: boolean
}

const OPTIONS: { value: RecurringScope; label: string; sub: string }[] = [
  { value: 'this',      label: 'This shift',                sub: 'Only this occurrence' },
  { value: 'following', label: 'This and following shifts', sub: 'This occurrence and all after it' },
  { value: 'all',       label: 'All shifts',                sub: 'Every occurrence in the series' },
]

export function RecurringActionModal({ mode, onConfirm, onCancel, recurrenceRuleChanged = false }: RecurringActionModalProps) {
  const [selected, setSelected] = useState<RecurringScope>(recurrenceRuleChanged ? 'all' : 'this')

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/40">
      <div className="w-full max-w-sm bg-paper border border-ink">

        {/* Header */}
        <div className="px-6 py-4 border-b border-ink">
          <p className="font-mono text-[9px] tracking-[0.12em] uppercase text-ink-soft mb-1">
            ↻ Recurring shift
          </p>
          <h2 className="font-serif text-[22px] leading-none tracking-[-0.01em]">
            {mode === 'delete' ? 'Delete shift' : 'Save changes'}
          </h2>
        </div>

        {/* Options */}
        <div className="px-6 py-5 flex flex-col gap-1">
          {recurrenceRuleChanged && (
            <p className="font-mono text-[9px] text-orange mb-2">
              Frequency changes apply to all or following shifts — not a single occurrence.
            </p>
          )}
          {OPTIONS.map(({ value, label, sub }) => {
            const disabled = recurrenceRuleChanged && value === 'this'
            return (
              <button
                key={value}
                type="button"
                disabled={disabled}
                onClick={() => !disabled && setSelected(value)}
                className={`w-full text-left px-4 py-3 border transition-colors ${
                  disabled
                    ? 'border-line-soft bg-paper text-ink-soft/40 cursor-not-allowed'
                    : selected === value
                    ? 'border-ink bg-ink text-cream'
                    : 'border-line-soft bg-paper text-ink hover:bg-cream-2'
                }`}
              >
                <p className={`font-mono text-[11px] tracking-[0.03em] ${selected === value && !disabled ? 'text-cream' : disabled ? 'text-ink-soft/40' : 'text-ink'}`}>
                  {label}
                </p>
                <p className={`font-mono text-[9px] mt-0.5 ${selected === value && !disabled ? 'text-cream/70' : 'text-ink-soft'}`}>
                  {disabled ? 'Not available when changing frequency' : sub}
                </p>
              </button>
            )
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-ink flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="border border-ink px-4 py-2 font-mono text-[10px] tracking-[0.08em] uppercase text-ink-soft hover:text-ink transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(selected)}
            className={`px-5 py-2 font-mono text-[10px] tracking-[0.08em] uppercase text-white hover:opacity-80 transition-opacity ${
              mode === 'delete' ? 'bg-orange' : 'bg-ink'
            }`}
          >
            {mode === 'delete' ? 'Delete' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
