import { createFileRoute } from '@tanstack/react-router'
import { format } from 'date-fns'
import { Kicker } from '@/shared/components/ui'
import { ShiftCalendar } from '@/features/shifts/components/ShiftCalendar'

export const Route = createFileRoute('/_protected/dashboard/shifts/')({
  component: ShiftsPage,
})

function ShiftsPage() {
  return (
    <div className="min-h-full bg-cream flex flex-col" style={{ height: 'calc(100vh - 89px)' }}>
      <div className="px-10 max-md:px-4 pt-10 max-md:pt-6 pb-6">
        <Kicker leader className="mb-4">04 / Schedule</Kicker>
        <h1 className="font-serif text-[52px] max-md:text-[36px] leading-[0.98] font-medium tracking-[-0.02em]">
          {format(new Date(), 'MMMM yyyy')}{' '}
          <span className="font-serif italic text-muted">— schedule</span>
        </h1>
      </div>
      <ShiftCalendar />
    </div>
  )
}
