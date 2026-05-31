import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { format } from 'date-fns'
import { type ShiftOccurrence } from '@/features/shifts/api'
import { useTodayShifts, useWeekShifts, useDroppedShifts } from '@/features/shifts/hooks/useShifts'
import { useClients } from '@/features/clients/hooks/useClients'
import { useWorkers } from '@/features/workers/hooks/useWorkers'
import { ShiftDetailDrawer } from '@/features/shifts/components/ShiftDetailDrawer'
import { DayTimeline } from '@/features/shifts/components/DayTimeline'
import { Card, Kicker } from '@/shared/components/ui'
import { DashboardStatsStrip } from '@/features/dashboard/components/DashboardStatsStrip'
import { DroppedShiftsAlert } from '@/features/dashboard/components/DroppedShiftsAlert'
import { WorkerUtilizationCard } from '@/features/dashboard/components/WorkerUtilizationCard'
import { ClientRosterCard } from '@/features/dashboard/components/ClientRosterCard'
import { ComplianceAlertsPanel } from '@/features/workers/components/ComplianceAlertsPanel'

export const Route = createFileRoute('/_protected/dashboard/')({
  component: DashboardPage,
})

function DashboardPage() {
  const [selectedShift, setSelectedShift] = useState<ShiftOccurrence | null>(null)

  const { data: todayShifts   = [], isLoading: loadingToday } = useTodayShifts()
  const { data: weekShifts    = [] }                          = useWeekShifts()
  const { data: droppedShifts = [] }                          = useDroppedShifts()
  const { data: clients       = [] }                          = useClients()
  const { data: workers       = [] }                          = useWorkers()

  const inProgress  = todayShifts.filter((s) => s.completion_status === 'in_progress')
  const scheduled   = todayShifts.filter((s) => s.completion_status === 'scheduled')
  const sortedToday = [...todayShifts].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
  const completed   = todayShifts.filter((s) => s.completion_status === 'completed')

  return (
    <div className="min-h-full bg-cream">

      {/* ── Hero ── */}
      <section className="px-10 max-md:px-4 pt-12 max-md:pt-6 pb-8 relative">
        <div className="absolute top-14 right-24 text-ink-soft opacity-40">
          <svg width="12" height="12" viewBox="0 0 12 12"><line x1="6" y1="0" x2="6" y2="12" stroke="currentColor" strokeWidth="1"/><line x1="0" y1="6" x2="12" y2="6" stroke="currentColor" strokeWidth="1"/></svg>
        </div>
        <div className="absolute top-48 right-64 text-ink-soft opacity-30">
          <svg width="12" height="12" viewBox="0 0 12 12"><line x1="6" y1="0" x2="6" y2="12" stroke="currentColor" strokeWidth="1"/><line x1="0" y1="6" x2="12" y2="6" stroke="currentColor" strokeWidth="1"/></svg>
        </div>
        <Kicker leader className="mb-5">{format(new Date(), 'EEEE, MMMM d, yyyy')}</Kicker>
        <h1 className="font-serif text-[64px] max-md:text-[36px] leading-[0.97] font-medium tracking-[-0.02em] max-w-4xl">
          {inProgress.length > 0 ? (
            <>Today there {inProgress.length === 1 ? 'is' : 'are'}{' '}<span className="tape">{inProgress.length} shift{inProgress.length !== 1 ? 's' : ''}</span>{' '}in progress{droppedShifts.length > 0 && (<> and <span className="tape-orange">{droppedShifts.length} {droppedShifts.length === 1 ? 'shift needs' : 'shifts need'}</span> a worker.</>)}.</>
          ) : (
            <><span className="tape">{scheduled.length} shift{scheduled.length !== 1 ? 's' : ''}</span>{' '}scheduled today{droppedShifts.length > 0 && (<> and <span className="tape-orange">{droppedShifts.length} {droppedShifts.length === 1 ? 'needs' : 'need'}</span> coverage.</>)}.</>
          )}
        </h1>
      </section>

      {/* ── Stat strip ── */}
      <section className="px-10 max-md:px-4 mb-8">
        <DashboardStatsStrip
          clients={clients}
          workers={workers}
          todayShifts={todayShifts}
          weekShifts={weekShifts}
          droppedShifts={droppedShifts}
        />
      </section>

      {/* ── Main grid ── */}
      <section className="px-10 max-md:px-4 grid grid-cols-3 max-md:grid-cols-1 gap-6 mb-8">
        <Card className="col-span-2 max-md:col-span-1 p-0">
          <div className="flex items-center justify-between px-6 py-5 border-b border-ink">
            <div>
              <Kicker className="mb-1">A · Live Timeline</Kicker>
              <h3 className="font-serif text-[26px] leading-none tracking-[-0.02em]">
                Today's shifts <span className="font-serif italic text-muted">— {format(new Date(), 'EEE, MMM d')}</span>
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

        <div className="flex flex-col gap-6">
          <DroppedShiftsAlert droppedShifts={droppedShifts} onSelectShift={setSelectedShift} />
          <WorkerUtilizationCard workers={workers} weekShifts={weekShifts} />
        </div>
      </section>

      {/* ── Compliance alerts ── */}
      <section className="px-10 max-md:px-4 mb-8">
        <ComplianceAlertsPanel />
      </section>

      {/* ── Client roster ── */}
      <section className="px-10 max-md:px-4 pb-12">
        <ClientRosterCard clients={clients} weekShifts={weekShifts} />
      </section>

      {selectedShift && (
        <ShiftDetailDrawer shift={selectedShift} onClose={() => setSelectedShift(null)} />
      )}
    </div>
  )
}
