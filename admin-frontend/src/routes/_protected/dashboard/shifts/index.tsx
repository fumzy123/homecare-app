import { createFileRoute, useRouterState } from '@tanstack/react-router'
import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { calendarDate, recordId } from '@/features/attention/search'
import { Kicker, Btn } from '@/shared/components/ui'
import { ShiftCalendar } from '@/features/shifts/components/ShiftCalendar'

export const Route = createFileRoute('/_protected/dashboard/shifts/')({
  validateSearch: (search: Record<string, unknown>) => ({
    worker: recordId(search.worker),
    client: recordId(search.client),
    shift: recordId(search.shift),
    date: calendarDate(search.date),
    occurrence: calendarDate(search.occurrence),
  }),
  component: ShiftsPage,
})

function ShiftsPage() {
  const { worker, client, shift, date, occurrence } = Route.useSearch()
  const attentionNavigationId = useRouterState({ select: s => s.location.state.attentionNavigationId })
  const [showNewShift, setShowNewShift] = useState(false)

  return (
    <div className="min-h-full bg-cream flex flex-col" style={{ height: 'calc(100vh - 89px)' }}>
      <div className="flex shrink-0 flex-wrap items-end justify-between gap-y-5 gap-x-4 px-10 max-md:px-4 pt-10 max-md:pt-6 pb-6">
        <div>
          <Kicker leader className="mb-4">04 / Schedule</Kicker>
          <h1 className="font-serif text-[52px] max-md:text-[36px] leading-[0.98] font-medium tracking-[-0.02em]">
            {format(date ? parseISO(date) : new Date(), 'MMMM yyyy')}{' '}
            <span className="font-serif italic text-muted">— schedule</span>
          </h1>
        </div>
        <Btn variant="ghost" onClick={() => setShowNewShift(true)} className="max-sm:w-full max-sm:justify-center">
          ＊ New shift
        </Btn>
      </div>
      <ShiftCalendar key={[worker, client, shift, date, occurrence, attentionNavigationId].join(':')} showNewShiftDrawer={showNewShift} onNewShiftDrawerClose={() => setShowNewShift(false)} initialWorkerId={worker} initialClientId={client} initialDate={date} targetShiftId={shift} targetOccurrence={occurrence ?? date} />
    </div>
  )
}
