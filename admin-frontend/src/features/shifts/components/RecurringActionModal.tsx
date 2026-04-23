import { useState } from 'react'

export type RecurringScope = 'this' | 'following' | 'all'

interface RecurringActionModalProps {
  mode: 'delete' | 'edit'
  onConfirm: (scope: RecurringScope) => void
  onCancel: () => void
}

const OPTIONS: { value: RecurringScope; label: string }[] = [
  { value: 'this',      label: 'This shift' },
  { value: 'following', label: 'This and following shifts' },
  { value: 'all',       label: 'All shifts' },
]

export function RecurringActionModal({ mode, onConfirm, onCancel }: RecurringActionModalProps) {
  const [selected, setSelected] = useState<RecurringScope>('this')

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl">
        <h2 className="text-base font-semibold text-gray-900">
          {mode === 'delete' ? 'Delete recurring shift' : 'Edit recurring shift'}
        </h2>

        <div className="mt-4 flex flex-col gap-3">
          {OPTIONS.map(({ value, label }) => (
            <label key={value} className="flex cursor-pointer items-center gap-3">
              <input
                type="radio"
                name="recurring-scope"
                value={value}
                checked={selected === value}
                onChange={() => setSelected(value)}
                className="h-4 w-4 accent-gray-900"
              />
              <span className="text-sm text-gray-700">{label}</span>
            </label>
          ))}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(selected)}
            className={`rounded-md px-4 py-2 text-sm font-medium text-white ${
              mode === 'delete'
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-gray-900 hover:bg-gray-700'
            }`}
          >
            {mode === 'delete' ? 'Delete' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
