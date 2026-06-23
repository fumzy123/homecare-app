import { StatCard } from '@/shared/components/ui'
import { SERVICE_TYPE_LABELS } from '@/features/authorizations/constants'
import type { ServiceType } from '@/features/authorizations/api'
import { useClientCareMetrics } from '../hooks/useCareMetrics'
import { usePeriodRange } from '../hooks/usePeriodRange'
import { PeriodRangeControl } from './PeriodRangeControl'
import { ClientShiftsTable } from './ClientShiftsTable'

function serviceLabel(s: ServiceType | null): string {
  return s ? SERVICE_TYPE_LABELS[s] : 'Unspecified'
}

export function ClientCareMetrics({ clientId }: { clientId: string }) {
  const period = usePeriodRange('this_month')
  const { from, to, periodLabel } = period

  const { data: metrics, isLoading } = useClientCareMetrics(clientId, from, to)

  return (
    <div className="p-10 space-y-8">
      <PeriodRangeControl p={period} />

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
      <ClientShiftsTable clientId={clientId} from={from} to={to} periodLabel={periodLabel} />
    </div>
  )
}
