import { PeriodToggle, DateInput } from '@/shared/components/ui'
import { CARE_METRIC_PERIODS } from '@/features/shifts/utils/period'
import type { PeriodMode, PeriodRange } from '../hooks/usePeriodRange'

const TOGGLE_OPTIONS = [...CARE_METRIC_PERIODS, { key: 'custom' as const, label: 'Custom' }]
const labelClass = 'block font-mono text-[9px] tracking-[0.1em] uppercase text-ink-soft mb-1'

/** The shared period selector used across client tabs — preset toggle, a date
 *  range label, and the custom from/to inputs when "Custom" is chosen. */
export function PeriodRangeControl({ p }: { p: PeriodRange }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PeriodToggle options={TOGGLE_OPTIONS} value={p.mode} onChange={(v) => p.setMode(v as PeriodMode)} />
        <span className="font-mono text-[11px] text-ink-soft">{p.rangeLabel}</span>
      </div>

      {p.mode === 'custom' && (
        <div className="flex flex-wrap items-end gap-4 border border-line-soft bg-paper px-5 py-4">
          <div>
            <label className={labelClass}>From</label>
            <DateInput value={p.customFrom} onChange={p.setCustomFrom} />
          </div>
          <div>
            <label className={labelClass}>To</label>
            <DateInput value={p.customTo} min={p.customFrom} onChange={p.setCustomTo} />
          </div>
        </div>
      )}
    </div>
  )
}
