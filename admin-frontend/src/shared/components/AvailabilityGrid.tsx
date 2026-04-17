import { Info } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ScheduleMap = Record<string, string[]>

// ─── Constants ────────────────────────────────────────────────────────────────

const DAYS = [
  { key: 'MO', label: 'Mon' },
  { key: 'TU', label: 'Tue' },
  { key: 'WE', label: 'Wed' },
  { key: 'TH', label: 'Thu' },
  { key: 'FR', label: 'Fri' },
  { key: 'SA', label: 'Sat' },
  { key: 'SU', label: 'Sun' },
]

const PERIODS = [
  { key: 'morning',   label: 'Morning',   hours: '6am – 12pm' },
  { key: 'afternoon', label: 'Afternoon', hours: '12pm – 6pm' },
  { key: 'evening',   label: 'Evening',   hours: '6pm – 11pm' },
  { key: 'overnight', label: 'Overnight', hours: '11pm – 6am' },
]

// ─── Props ────────────────────────────────────────────────────────────────────

interface AvailabilityGridProps {
  value: ScheduleMap
  onChange: (v: ScheduleMap) => void
  readOnly?: boolean
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AvailabilityGrid({ value, onChange, readOnly = false }: AvailabilityGridProps) {
  function isChecked(day: string, period: string) {
    return (value[day] ?? []).includes(period)
  }

  function toggle(day: string, period: string) {
    if (readOnly) return
    const current = value[day] ?? []
    const has = current.includes(period)
    const updated = has ? current.filter((p) => p !== period) : [...current, period]
    const next = { ...value }
    if (updated.length === 0) {
      delete next[day]
    } else {
      next[day] = updated
    }
    onChange(next)
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            {/* Period label column header — empty */}
            <th className="w-28 pb-2" />
            {DAYS.map((d) => (
              <th
                key={d.key}
                className="pb-2 text-center text-xs font-medium text-gray-500 w-10"
              >
                {d.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PERIODS.map((period) => (
            <tr key={period.key}>
              {/* Period label + tooltip */}
              <td className="py-1.5 pr-3">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-medium text-gray-700">{period.label}</span>
                  <div className="group relative">
                    <Info size={11} className="cursor-help text-gray-400" />
                    <div className="pointer-events-none absolute left-5 top-1/2 z-10 -translate-y-1/2 whitespace-nowrap rounded bg-gray-800 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
                      {period.hours}
                    </div>
                  </div>
                </div>
              </td>
              {/* Day cells */}
              {DAYS.map((day) => {
                const checked = isChecked(day.key, period.key)
                return (
                  <td key={day.key} className="py-1.5 text-center">
                    <button
                      type="button"
                      disabled={readOnly}
                      onClick={() => toggle(day.key, period.key)}
                      aria-label={`${day.label} ${period.label}`}
                      aria-pressed={checked}
                      className={`mx-auto flex h-7 w-7 items-center justify-center rounded transition-colors
                        ${checked
                          ? 'bg-gray-900 text-white'
                          : 'border border-gray-200 bg-white text-transparent hover:border-gray-400'
                        }
                        ${readOnly ? 'cursor-default' : 'cursor-pointer'}
                      `}
                    >
                      {checked && (
                        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                          <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </button>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
