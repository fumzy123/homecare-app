import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { format } from 'date-fns'
import { type ShiftOccurrence } from '@/features/shifts/api'
import { useTodayShifts, useWeekShifts, useDroppedShifts } from '@/features/shifts/hooks/useShifts'
import { useClients } from '@/features/clients/hooks/useClients'
import { useWorkers } from '@/features/workers/hooks/useWorkers'
import { ShiftDetailDrawer } from '@/features/shifts/components/ShiftDetailDrawer'
import { TodayShiftsTimeline } from '@/features/dashboard/components/TodayShiftsTimeline'
import { Kicker } from '@/shared/components/ui'
import { DashboardStatsStrip } from '@/features/dashboard/components/DashboardStatsStrip'
import { DashboardAttention } from '@/features/attention/components/DashboardAttention'
import { WorkerUtilizationCard } from '@/features/dashboard/components/WorkerUtilizationCard'
import { ClientRosterCard } from '@/features/dashboard/components/ClientRosterCard'

export const Route = createFileRoute('/_protected/dashboard/')({
  component: DashboardPage,
})

function DashboardPage() {
  const [selectedShift, setSelectedShift] = useState<ShiftOccurrence | null>(null)

  const { data: todayShifts   = [], isLoading: loadingToday } = useTodayShifts()
  const { data: weekShifts = [] } = useWeekShifts()
  const { data: droppedShifts = [] } = useDroppedShifts()
  const { data: clients = [] } = useClients()
  const { data: workers       = [] }                          = useWorkers()

  const inProgress  = todayShifts.filter((s) => s.completion_status === 'in_progress')
  const scheduled   = todayShifts.filter((s) => s.completion_status === 'scheduled')

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
        <TodayShiftsTimeline
          shifts={todayShifts}
          isLoading={loadingToday}
          onSelectShift={setSelectedShift}
        />

        <div className="flex flex-col gap-6">
          <DashboardAttention />
          <WorkerUtilizationCard workers={workers} weekShifts={weekShifts} />
        </div>
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
