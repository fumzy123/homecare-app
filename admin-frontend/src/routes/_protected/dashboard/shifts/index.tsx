import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { format } from 'date-fns'
import { Kicker, Btn } from '@/shared/components/ui'
import { ShiftCalendar } from '@/features/shifts/components/ShiftCalendar'

export const Route = createFileRoute('/_protected/dashboard/shifts/')({
  validateSearch: (search: Record<string, unknown>): { worker?: string } => ({
    worker: typeof search.worker === 'string' ? search.worker : undefined,
  }),
  component: ShiftsPage,
})

function ShiftsPage() {
  const { worker } = Route.useSearch()
  const [showNewShift, setShowNewShift] = useState(false)

  return (
    <div className="min-h-full bg-cream flex flex-col" style={{ height: 'calc(100vh - 89px)' }}>
      <div className="flex shrink-0 flex-wrap items-end justify-between gap-y-5 gap-x-4 px-10 max-md:px-4 pt-10 max-md:pt-6 pb-6">
        <div>
          <Kicker leader className="mb-4">04 / Schedule</Kicker>
          <h1 className="font-serif text-[52px] max-md:text-[36px] leading-[0.98] font-medium tracking-[-0.02em]">
            {format(new Date(), 'MMMM yyyy')}{' '}
            <span className="font-serif italic text-muted">— schedule</span>
          </h1>
        </div>
        <Btn variant="ghost" onClick={() => setShowNewShift(true)} className="max-sm:w-full max-sm:justify-center">
          ＊ New shift
        </Btn>
      </div>
      <ShiftCalendar showNewShiftDrawer={showNewShift} onNewShiftDrawerClose={() => setShowNewShift(false)} initialWorkerId={worker} />
    </div>
  )
}
