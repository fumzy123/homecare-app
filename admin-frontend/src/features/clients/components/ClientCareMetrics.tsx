import { useMemo, useState } from 'react'
import { StatCard, PeriodToggle, DateInput } from '@/shared/components/ui'
import { CARE_METRIC_PERIODS, getDateRange, getDateRangeLabel, type Period } from '@/features/shifts/utils/period'
import { SERVICE_TYPE_LABELS } from '@/features/authorizations/constants'
import type { ServiceType } from '@/features/authorizations/api'
import { useClientCareMetrics } from '../hooks/useCareMetrics'
import { ClientShiftsTable } from './ClientShiftsTable'

type Mode = Period | 'custom'

const TOGGLE_OPTIONS = [...CARE_METRIC_PERIODS, { key: 'custom' as const, label: 'Custom' }]

const PERIOD_PHRASE: Record<Period, string> = {
  this_week:  'this week',
  this_month: 'this month',
  last_90:    'last 90 days',
  this_year:  'this year',
  all_time:   'all time',
}

const labelClass = 'block font-mono text-[9px] tracking-[0.1em] uppercase text-ink-soft mb-1'

function serviceLabel(s: ServiceType | null): string {
  return s ? SERVICE_TYPE_LABELS[s] : 'Unspecified'
}

export function ClientCareMetrics({ clientId }: { clientId: string }) {
  const [mode, setMode] = useState<Mode>('this_month')
  const preset = getDateRange('this_month')
  const [customFrom, setCustomFrom] = useState(preset.from)
  const [customTo, setCustomTo] = useState(preset.to)

  const { from, to, rangeLabel } = useMemo(() => {
    if (mode === 'custom') return { from: customFrom, to: customTo, rangeLabel: `${customFrom} → ${customTo}` }
    return { ...getDateRange(mode), rangeLabel: getDateRangeLabel(mode) }
  }, [mode, customFrom, customTo])

  const { data: metrics, isLoading } = useClientCareMetrics(clientId, from, to)

  return (
    <div className="p-10 space-y-8">
      {/* Header + period control */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-serif text-[28px] tracking-[-0.02em] leading-none">
            Scheduled vs delivered
          </h2>
          <div className="mt-3">
            <PeriodToggle options={TOGGLE_OPTIONS} value={mode} onChange={(v) => setMode(v as Mode)} />
          </div>
        </div>
        <span className="font-mono text-[11px] text-ink-soft">{rangeLabel}</span>
      </div>

      {mode === 'custom' && (
        <div className="flex flex-wrap items-end gap-4 border border-line-soft bg-paper px-5 py-4">
          <div>
            <label className={labelClass}>From</label>
            <DateInput value={customFrom} onChange={setCustomFrom} />
          </div>
          <div>
            <label className={labelClass}>To</label>
            <DateInput value={customTo} min={customFrom} onChange={setCustomTo} />
          </div>
        </div>
      )}

      {/* Headline cards */}
      <div className="grid grid-cols-2 gap-0 border border-ink bg-paper">
        <StatCard
          label="Scheduled care"
          value={`${metrics?.scheduled_hours ?? 0}h`}
          sub={`${metrics?.scheduled_shifts ?? 0} shift${metrics?.scheduled_shifts === 1 ? '' : 's'} on the calendar`}
          className="border-r border-ink"
        />
        <StatCard
          label="Delivered care"
          value={`${metrics?.delivered_hours ?? 0}h`}
          sub={`${metrics?.delivered_shifts ?? 0} completed shift${metrics?.delivered_shifts === 1 ? '' : 's'}`}
        />
      </div>

      {/* Per-service breakdown */}
      <div className="border border-ink bg-paper">
        <div className="flex items-center justify-between px-6 py-4 border-b border-ink">
          <p className="font-mono text-[9px] tracking-[0.12em] uppercase text-ink-soft">By service</p>
          <p className="font-mono text-[9px] text-muted">Delivered = completed shifts (provisional until EVV)</p>
        </div>

        <div className="grid grid-cols-[1fr_auto_auto] gap-x-8 px-6 py-2.5 bg-cream-2 border-b border-line-soft">
          {['Service', 'Scheduled', 'Delivered'].map((h, i) => (
            <p key={h} className={`font-mono text-[9px] tracking-[0.1em] uppercase text-ink-soft ${i ? 'text-right' : ''}`}>{h}</p>
          ))}
        </div>

        {isLoading ? (
          <p className="px-6 py-8 font-mono text-[10px] text-muted text-center tracking-wide">LOADING…</p>
        ) : !metrics || metrics.by_service.length === 0 ? (
          <p className="px-6 py-8 font-mono text-[10px] text-muted text-center tracking-wide">NO CARE IN THIS PERIOD</p>
        ) : (
          metrics.by_service.map((row, i) => (
            <div key={row.service_type ?? 'unspecified'}
              className={`grid grid-cols-[1fr_auto_auto] gap-x-8 items-center px-6 py-3 ${i ? 'border-t border-dashed border-line-soft' : ''}`}>
              <span className={`text-[13px] ${row.service_type ? '' : 'text-muted italic'}`}>{serviceLabel(row.service_type)}</span>
              <span className="font-mono text-[11px] text-right whitespace-nowrap">
                <span className="font-bold">{row.scheduled_hours}h</span>
                <span className="text-ink-soft"> · {row.scheduled_shifts}</span>
              </span>
              <span className="font-mono text-[11px] text-right whitespace-nowrap">
                <span className="font-bold">{row.delivered_hours}h</span>
                <span className="text-ink-soft"> · {row.delivered_shifts}</span>
              </span>
            </div>
          ))
        )}
      </div>

      {/* All shifts in the selected period — click to open */}
      <ClientShiftsTable clientId={clientId} from={from} to={to}
        periodLabel={mode === 'custom' ? 'selected range' : PERIOD_PHRASE[mode]} />
    </div>
  )
}
