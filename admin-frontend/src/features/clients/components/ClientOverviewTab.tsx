import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { format } from 'date-fns'
import { StatCard, PeriodToggle, Kicker } from '@/shared/components/ui'
import { PERIODS, getDateRangeLabel, weekNum, type Period } from '@/features/shifts/utils/period'
import { useClientShiftStats, useClientShifts, useUpcomingVisits } from '../hooks/useClientVisits'
import { useClientAuthorizations, useAuthorizationCompliance } from '@/features/authorizations/hooks/useAuthorizations'
import { useCareSchedule } from '@/features/authorizations/hooks/useCareSchedule'
import { SERVICE_TYPE_LABELS, HOURS_PERIOD_LABELS } from '@/features/authorizations/constants'
import { activeAuthorization, endsRelLabel, fmtHours } from '@/features/authorizations/utils'
import type { ShiftOccurrence } from '@/features/shifts/api'

function completedHours(shifts: ShiftOccurrence[]): number {
  return shifts
    .filter((s) => s.completion_status === 'completed')
    .reduce((sum, s) => sum + (new Date(s.end_time).getTime() - new Date(s.start_time).getTime()) / 3_600_000, 0)
}

// ── Authorized / Planned / Delivered meter over the bi-weekly window ──
function UtilMeter({ authorized, planned, delivered }: { authorized: number; planned: number; delivered: number }) {
  const max = Math.max(authorized, planned, delivered, 1)
  const rows: [string, number, string, string][] = [
    ['Authorized', authorized, 'bg-ink',       'bi-weekly cap'],
    ['Planned',    planned,    'bg-mint-dark', 'care-plan blocks'],
    ['Delivered',  delivered,  'bg-orange',    'completed visits'],
  ]
  const compliant = planned <= authorized + 1e-9
  return (
    <div className="border border-ink bg-paper px-6 py-5">
      <div className="flex items-baseline justify-between mb-4">
        <Kicker leader>Authorized vs delivered · bi-weekly window</Kicker>
        <span className={`font-mono text-[10px] tracking-[0.04em] uppercase ${compliant ? 'text-mint-dark' : 'text-orange'}`}>
          ● {compliant ? 'Plan within authorization' : 'Plan over authorization'}
        </span>
      </div>
      <div className="flex flex-col gap-3.5">
        {rows.map(([label, value, fill, sub]) => (
          <div key={label} className="grid grid-cols-[92px_1fr_64px] items-center gap-3.5" title={sub}>
            <span className="font-mono text-[10px] tracking-[0.06em] uppercase text-ink-soft">{label}</span>
            <div className="bar" style={{ height: 10 }}>
              <span className={`bar-fill ${fill}`} style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
            </div>
            <span className="font-mono text-[12px] text-right"><strong>{fmtHours(value)}h</strong></span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function ClientOverviewTab({ clientId }: { clientId: string }) {
  const [period, setPeriod] = useState<Period>('this_week')

  const { data: stats }              = useClientShiftStats(clientId, period)
  const { data: shifts = [] }        = useClientShifts(clientId, period)
  const { data: upcoming = [] }      = useUpcomingVisits(clientId)
  const { data: authorizations = [] } = useClientAuthorizations(clientId)
  const { data: compliance }         = useAuthorizationCompliance(clientId)
  const { data: blocks = [] }        = useCareSchedule(clientId)

  const auth = activeAuthorization(authorizations)

  const delivered     = completedHours(shifts)
  const authorizedBi  = (compliance?.services ?? []).reduce((s, c) => s + c.authorized_biweekly, 0)
  const plannedBi     = (compliance?.services ?? []).reduce((s, c) => s + c.planned_biweekly, 0)
  const planPerWeek   = plannedBi / 2
  const utilization   = authorizedBi > 0 ? Math.round((delivered / authorizedBi) * 100) : 0
  const upcomingCount = (stats?.scheduled ?? 0) + (stats?.in_progress ?? 0)

  return (
    <div className="p-8 flex flex-col gap-[22px]">
      {/* Period toggle */}
      <div className="flex items-center justify-between">
        <PeriodToggle options={PERIODS} value={period} onChange={setPeriod} />
        <span className="font-mono text-[11px] text-ink-soft">{getDateRangeLabel(period)} · WK {weekNum}</span>
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-4 border border-ink bg-paper">
        <StatCard label="Upcoming"    value={upcomingCount}              sub="scheduled visits" size="sm" className="border-r border-line-soft" />
        <StatCard label="Delivered"   value={`${delivered.toFixed(1)}h`} sub="this period"      size="sm" className="border-r border-line-soft" />
        <StatCard label="Plan / wk"   value={`${fmtHours(planPerWeek)}h`} sub={`${blocks.length} block${blocks.length === 1 ? '' : 's'}`} size="sm" className="border-r border-line-soft" />
        <StatCard label="Utilization" value={`${utilization}%`}          sub="of authorized"    size="sm" valueColor="text-orange" />
      </div>

      <div className="grid grid-cols-[1.5fr_1fr] gap-[22px] items-start">
        {/* Left: utilization + upcoming visits */}
        <div className="flex flex-col gap-[22px]">
          <UtilMeter authorized={authorizedBi} planned={plannedBi} delivered={delivered} />

          <div className="border border-ink bg-paper px-6 py-5">
            <div className="flex items-baseline justify-between mb-3.5">
              <h3 className="font-serif text-[22px] tracking-[-0.02em]">Upcoming visits</h3>
              <Link to="/dashboard/clients/$clientId/visits" params={{ clientId } as never}
                className="font-mono text-[10px] tracking-[0.04em] uppercase text-ink-soft hover:text-ink">View all →</Link>
            </div>
            {upcoming.length === 0 ? (
              <p className="font-mono text-[10px] text-muted tracking-wide py-4 text-center">NO UPCOMING VISITS SCHEDULED</p>
            ) : (
              <div className="flex flex-col">
                {upcoming.slice(0, 6).map((v, i) => {
                  const hrs = (new Date(v.end_time).getTime() - new Date(v.start_time).getTime()) / 3_600_000
                  return (
                    <div key={`${v.shift_id}-${v.date}`}
                      className={`grid grid-cols-[1.1fr_1.4fr_1.2fr_0.5fr] items-center py-3 ${i ? 'border-t border-dashed border-line-soft' : ''}`}>
                      <span className="font-mono text-[11px]">{format(new Date(v.date), 'EEE MMM d')}</span>
                      <span className="text-[13px]">{v.worker.first_name} {v.worker.last_name}</span>
                      <span className="font-mono text-[11px] text-ink-soft">
                        {format(new Date(v.start_time), 'HH:mm')} – {format(new Date(v.end_time), 'HH:mm')}
                      </span>
                      <span className="font-mono text-[11px] text-right">{fmtHours(hrs)}h</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: active authorization summary */}
        <div className="border border-ink bg-paper self-start">
          <div className="px-6 py-4 border-b border-ink flex items-center justify-between">
            <Kicker leader>Active authorization</Kicker>
            {auth
              ? <span className="font-mono text-[9px] tracking-[0.08em] uppercase px-2 py-1 bg-mint text-ink border border-ink">● Active</span>
              : <span className="font-mono text-[9px] tracking-[0.08em] uppercase px-2 py-1 border border-orange text-orange">● None</span>}
          </div>

          {auth ? (
            <div className="px-6 py-5 flex flex-col gap-3.5">
              <div>
                <p className="font-mono text-[9px] tracking-[0.1em] uppercase text-ink-soft mb-1">Funder · {auth.authorization_number}</p>
                <p className="font-serif text-[20px] leading-tight">{auth.funder}</p>
                <p className="font-mono text-[10px] text-muted mt-0.5">
                  {auth.funder_file_number ? `File #${auth.funder_file_number} · ` : ''}{HOURS_PERIOD_LABELS[auth.hours_period]}
                </p>
              </div>
              <div>
                <p className="font-mono text-[9px] tracking-[0.1em] uppercase text-ink-soft mb-1.5">Authorized services</p>
                <div className="flex flex-wrap gap-1.5">
                  {auth.services.map((s) => (
                    <span key={s.id} className="inline-flex items-center px-2 py-0.5 font-mono text-[10px] border border-line-soft bg-cream text-ink-soft">
                      {SERVICE_TYPE_LABELS[s.service_type]} · {fmtHours(s.authorized_hours)}h
                    </span>
                  ))}
                </div>
              </div>
              <div className="pt-3 border-t border-dashed border-line-soft flex items-center justify-between">
                <div>
                  <p className="font-mono text-[9px] tracking-[0.1em] uppercase text-ink-soft">Covering period</p>
                  <p className="font-mono text-[11.5px] mt-0.5">
                    {format(new Date(auth.covering_start), 'MMM d, yyyy')} → {auth.covering_end ? format(new Date(auth.covering_end), 'MMM d, yyyy') : 'open-ended'}
                  </p>
                </div>
                <span className="font-mono text-[9px] tracking-[0.04em] uppercase text-mint-dark whitespace-nowrap">{endsRelLabel(auth)}</span>
              </div>
              <Link to="/dashboard/clients/$clientId/authorization" params={{ clientId } as never}
                className="font-mono text-[10px] tracking-[0.06em] uppercase text-ink hover:text-orange flex items-center gap-1.5">
                Manage authorizations →
              </Link>
            </div>
          ) : (
            <div className="px-6 py-8 text-center">
              <p className="font-serif text-[18px] mb-1">No authorization</p>
              <p className="font-mono text-[10px] text-muted tracking-wide mb-4">THIS CLIENT HAS NO ACTIVE FUNDING</p>
              <Link to="/dashboard/clients/$clientId/authorization" params={{ clientId } as never}
                className="inline-flex rounded-full border border-ink px-4 py-2 font-mono text-[11px] hover:bg-ink hover:text-cream transition-colors">
                ＋ Add authorization
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
