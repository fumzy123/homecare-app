import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { format, startOfWeek, endOfWeek, subDays, addDays } from 'date-fns'
import { clientsApi } from '@/features/clients/api'
import { workersApi } from '@/features/workers/api'
import { shiftsApi, type ShiftOccurrence } from '@/features/shifts/api'
import { ShiftDetailDrawer } from '@/features/shifts/components/ShiftDetailDrawer'
import { DayTimeline } from '@/features/shifts/components/DayTimeline'
import { Card, Avatar, Kicker, ProgressBar } from '@/shared/components/ui'

export const Route = createFileRoute('/_protected/dashboard/')({
  component: DashboardPage,
})

const today    = format(new Date(), 'yyyy-MM-dd')
const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')
const weekEnd   = format(endOfWeek(new Date(),   { weekStartsOn: 1 }), 'yyyy-MM-dd')
const weekStartDisplay = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'MMM d')
const weekEndDisplay   = format(endOfWeek(new Date(),   { weekStartsOn: 1 }), 'MMM d')
const droppedFrom = format(subDays(new Date(), 7),  'yyyy-MM-dd')
const droppedTo   = format(addDays(new Date(), 60), 'yyyy-MM-dd')

function DashboardPage() {
  const [selectedShift, setSelectedShift] = useState<ShiftOccurrence | null>(null)

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => clientsApi.listClients(),
  })
  const { data: workers = [] } = useQuery({
    queryKey: ['workers'],
    queryFn: workersApi.listWorkers,
  })
  const { data: todayShifts = [], isLoading: loadingToday } = useQuery({
    queryKey: ['shifts', today, today],
    queryFn: () => shiftsApi.listShifts(today, today),
  })
  const { data: weekShifts = [] } = useQuery({
    queryKey: ['shifts', weekStart, weekEnd],
    queryFn: () => shiftsApi.listShifts(weekStart, weekEnd),
  })
  const { data: droppedShifts = [] } = useQuery({
    queryKey: ['shifts', droppedFrom, droppedTo, 'dropped'],
    queryFn: () => shiftsApi.listShifts(droppedFrom, droppedTo, undefined, undefined, ['dropped']),
  })

  const activeClients = clients.filter((c) => c.status === 'active')
  const activeWorkers = workers.filter((w) => w.is_active)
  const onHoldClients = clients.filter((c) => c.status === 'on_hold')

  const inProgress = todayShifts.filter((s) => s.completion_status === 'in_progress')
  const completed  = todayShifts.filter((s) => s.completion_status === 'completed')
  const scheduled  = todayShifts.filter((s) => s.completion_status === 'scheduled')

  const sortedToday   = [...todayShifts].sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  )
  const sortedDropped = [...droppedShifts].sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  )

  const TARGET_HOURS = 40

  const workerHours = weekShifts.reduce<Record<string, number>>((acc, shift) => {
    if (['cancelled', 'dropped'].includes(shift.completion_status)) return acc
    const hrs = (new Date(shift.end_time).getTime() - new Date(shift.start_time).getTime()) / 3_600_000
    acc[shift.worker.id] = (acc[shift.worker.id] ?? 0) + hrs
    return acc
  }, {})

  const clientHours = weekShifts.reduce<Record<string, number>>((acc, shift) => {
    if (['cancelled', 'dropped'].includes(shift.completion_status)) return acc
    const hrs = (new Date(shift.end_time).getTime() - new Date(shift.start_time).getTime()) / 3_600_000
    acc[shift.client.id] = (acc[shift.client.id] ?? 0) + hrs
    return acc
  }, {})

  const rosterClients = [...activeClients]
    .sort((a, b) => (clientHours[b.id] ?? 0) - (clientHours[a.id] ?? 0))
    .slice(0, 7)

  const STATS = [
    { label: 'Active clients',   value: activeClients.length, sub: onHoldClients.length > 0 ? `${onHoldClients.length} on hold` : 'all active',    accent: false },
    { label: 'Active workers',   value: activeWorkers.length, sub: `of ${workers.length} total`,                                                    accent: false },
    { label: 'Shifts today',     value: todayShifts.length,   sub: format(new Date(), 'EEEE, MMM d'),                                               accent: false },
    { label: 'Shifts this week', value: weekShifts.length,    sub: `${weekStartDisplay} – ${weekEndDisplay}`,                                       accent: droppedShifts.length > 0 },
  ]

  return (
    <div className="min-h-full bg-cream">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="px-10 pt-12 pb-8 relative">
        <div className="absolute top-14 right-24 text-ink-soft opacity-40">
          <svg width="12" height="12" viewBox="0 0 12 12"><line x1="6" y1="0" x2="6" y2="12" stroke="currentColor" strokeWidth="1"/><line x1="0" y1="6" x2="12" y2="6" stroke="currentColor" strokeWidth="1"/></svg>
        </div>
        <div className="absolute top-48 right-64 text-ink-soft opacity-30">
          <svg width="12" height="12" viewBox="0 0 12 12"><line x1="6" y1="0" x2="6" y2="12" stroke="currentColor" strokeWidth="1"/><line x1="0" y1="6" x2="12" y2="6" stroke="currentColor" strokeWidth="1"/></svg>
        </div>

        <Kicker leader className="mb-5">{format(new Date(), 'EEEE, MMMM d, yyyy')}</Kicker>

        <h1 className="font-serif text-[64px] leading-[0.97] font-medium tracking-[-0.02em] max-w-4xl">
          {inProgress.length > 0 ? (
            <>
              Today there {inProgress.length === 1 ? 'is' : 'are'}{' '}
              <span className="tape">{inProgress.length} shift{inProgress.length !== 1 ? 's' : ''}</span>{' '}
              in progress
              {droppedShifts.length > 0 && (
                <> and <span className="tape-orange">{droppedShifts.length} {droppedShifts.length === 1 ? 'shift needs' : 'shifts need'}</span> a worker.</>
              )}.
            </>
          ) : (
            <>
              <span className="tape">{scheduled.length} shift{scheduled.length !== 1 ? 's' : ''}</span>{' '}
              scheduled today
              {droppedShifts.length > 0 && (
                <> and <span className="tape-orange">{droppedShifts.length} {droppedShifts.length === 1 ? 'needs' : 'need'}</span> coverage.</>
              )}.
            </>
          )}
        </h1>

      </section>

      {/* ── Stat strip ───────────────────────────────────────────────────── */}
      <section className="px-10 mb-8">
        <div className="grid grid-cols-4 border border-ink bg-paper">
          {STATS.map((s, i) => (
            <div key={i} className={`px-7 py-6 relative ${i < 3 ? 'border-r border-ink' : ''}`}>
              <div className="font-mono text-[10px] tracking-[0.12em] uppercase text-ink-soft mb-4">
                {s.label}
              </div>
              <div className="flex items-baseline gap-3">
                <span className={`font-serif text-[72px] leading-none ${s.accent ? 'text-orange' : 'text-ink'}`}>
                  {s.value}
                </span>
                <span className="font-mono text-[11px] text-ink-soft">{s.sub}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Main grid ────────────────────────────────────────────────────── */}
      <section className="px-10 grid grid-cols-3 gap-6 mb-8">

        {/* Today's timeline — 2/3 width */}
        <Card className="col-span-2 p-0">
          <div className="flex items-center justify-between px-6 py-5 border-b border-ink">
            <div>
              <Kicker className="mb-1">A · Live Timeline</Kicker>
              <h3 className="font-serif text-[26px] leading-none tracking-[-0.02em]">
                Today's shifts{' '}
                <span className="font-serif italic text-muted">— {format(new Date(), 'EEE, MMM d')}</span>
              </h3>
            </div>
            <div className="flex items-center gap-5 font-mono text-[10px]">
              <span className="flex items-center gap-1.5"><span className="dot dot-mint" /> In progress {inProgress.length}</span>
              <span className="flex items-center gap-1.5"><span className="dot dot-ink" /> Done {completed.length}</span>
              <span className="flex items-center gap-1.5"><span className="dot dot-orange" /> Upcoming {scheduled.length}</span>
            </div>
          </div>

          {loadingToday ? (
            <p className="px-6 py-10 text-center font-mono text-[11px] text-muted tracking-wide">LOADING…</p>
          ) : (
            <DayTimeline shifts={sortedToday} onSelectShift={setSelectedShift} />
          )}
        </Card>

        {/* Right column — 1/3 width */}
        <div className="flex flex-col gap-6">

          {/* Shifts needing coverage */}
          {sortedDropped.length > 0 ? (
            <Card variant="orange" className="p-6">
              <div className="font-mono text-[10px] tracking-[0.15em] opacity-80 mb-2">B / NEEDS ATTENTION</div>
              <div className="font-serif text-[28px] leading-[1.05] mb-3">
                {sortedDropped.length} shift{sortedDropped.length !== 1 ? 's' : ''} dropped
              </div>
              <div className="space-y-3">
                {sortedDropped.slice(0, 2).map((shift) => (
                  <div key={`${shift.shift_id}-${shift.date}`} className="text-[12px] opacity-90 leading-snug">
                    {format(new Date(shift.start_time), 'EEE MMM d')} · {format(new Date(shift.start_time), 'h:mm a')} – {format(new Date(shift.end_time), 'h:mm a')} · {shift.client.first_name} {shift.client.last_name}
                    {shift.notes && <span className="opacity-70"> — {shift.notes}</span>}
                  </div>
                ))}
              </div>
              <button
                onClick={() => sortedDropped[0] && setSelectedShift(sortedDropped[0])}
                className="mt-5 flex items-center gap-2 px-4 py-2 bg-white text-orange border border-white rounded-full font-mono text-[11px] tracking-wide hover:bg-ink hover:text-cream hover:border-ink transition-all"
              >
                Assign worker →
              </button>
            </Card>
          ) : (
            <Card className="p-6">
              <Kicker className="mb-2">B / Coverage</Kicker>
              <div className="font-serif text-[22px] leading-none mt-2 mb-1">All shifts covered</div>
              <p className="font-mono text-[10px] text-muted tracking-wide">NO ACTION NEEDED</p>
            </Card>
          )}

          {/* Worker utilization */}
          <Card className="p-6">
            <Kicker className="mb-1">C / Utilization</Kicker>
            <h3 className="font-serif text-[22px] leading-none mt-2 mb-1">
              Worker hours <span className="italic text-muted">— this week</span>
            </h3>
            <div className="space-y-4">
              {activeWorkers.slice(0, 5).map((w, i) => {
                const hrs = Math.round(workerHours[w.id] ?? 0)
                return (
                  <div key={w.id}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <Avatar
                          initials={`${w.first_name[0]}${w.last_name[0]}`}
                          color={(['c1','c2','c3','c4','c5'] as const)[i % 5]}
                          size="sm"
                        />
                        <span className="text-[12px] font-medium">{w.first_name} {w.last_name}</span>
                      </div>
                      <span className="font-mono text-[11px] text-ink-soft">
                        <span className="font-bold text-ink">{hrs}</span>/{TARGET_HOURS}h
                      </span>
                    </div>
                    <ProgressBar value={hrs} max={TARGET_HOURS} variant="mint" />
                  </div>
                )
              })}
              {activeWorkers.length === 0 && (
                <p className="font-mono text-[10px] text-muted tracking-wide">NO ACTIVE WORKERS</p>
              )}
            </div>
          </Card>
        </div>
      </section>

      {/* ── Client roster strip ───────────────────────────────────────────── */}
      <section className="px-10 pb-12">
        <Card variant="cream" className="p-0">
          <div className="px-6 py-5 border-b border-ink">
            <Kicker className="mb-1">E / Clients by hours</Kicker>
            <h3 className="font-serif text-[24px] leading-none mt-2 tracking-[-0.02em]">
              Active client roster
            </h3>
          </div>
          <div>
            {rosterClients.map((c, i) => {
              const age = c.date_of_birth
                ? new Date().getFullYear() - new Date(c.date_of_birth).getFullYear()
                : null
              const hrs = Math.round(clientHours[c.id] ?? 0)
              return (
                <div
                  key={c.id}
                  className={`flex items-center gap-5 px-6 py-4 ${i > 0 ? 'border-t border-dashed border-line-soft' : ''}`}
                >
                  <span className="font-mono text-[10px] text-muted w-6 shrink-0">{String(i + 1).padStart(2, '0')}</span>
                  <Avatar
                    initials={`${c.first_name[0]}${c.last_name[0]}`}
                    color={(['c1','c2','c3','c4','c5','c6'] as const)[i % 6]}
                  />
                  <div className="min-w-0" style={{ width: 180 }}>
                    <p className="text-[13px] font-medium">{c.first_name} {c.last_name}</p>
                    <p className="font-mono text-[10px] text-ink-soft">{age ? `age ${age}` : '—'}</p>
                  </div>
                  <p className="flex-1 font-mono text-[11px] text-ink-soft leading-snug">
                    {c.medical_conditions ?? '—'}
                  </p>
                  <span className="font-mono text-[13px] font-bold shrink-0">{hrs}h/wk</span>
                </div>
              )
            })}
            {activeClients.length === 0 && (
              <p className="px-6 py-8 font-mono text-[11px] text-muted text-center tracking-wide">NO ACTIVE CLIENTS</p>
            )}
          </div>
        </Card>
      </section>

      {selectedShift && (
        <ShiftDetailDrawer shift={selectedShift} onClose={() => setSelectedShift(null)} />
      )}
    </div>
  )
}
