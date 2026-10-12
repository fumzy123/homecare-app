import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { Kicker } from '@/shared/components/ui'
import { TimesheetTable } from '@/features/shifts/components/TimesheetTable'
import { useTimesheetDefaults } from '@/features/shifts/utils/timesheet'

export const Route = createFileRoute('/_protected/dashboard/timesheet/')({
  component: TimesheetPage,
})

function TimesheetPage() {
  const { fromDate: defaultFrom, toDate: defaultTo } = useTimesheetDefaults()
  const [fromDate, setFromDate] = useState(defaultFrom)
  const [toDate, setToDate]     = useState(defaultTo)

  return (
    <div className="min-h-full bg-cream flex flex-col">
      <div className="flex shrink-0 flex-wrap items-end justify-between gap-y-5 gap-x-4 px-10 max-md:px-4 pt-10 max-md:pt-6 pb-6">
        <div>
          <Kicker leader className="mb-4">05 / Timesheets</Kicker>
          <h1 className="font-serif text-[52px] max-md:text-[36px] leading-[0.98] font-medium tracking-[-0.02em]">
            Timesheets{' '}
            <span className="font-serif italic text-muted">— scheduled hours</span>
          </h1>
        </div>
      </div>

      <p className="px-10 max-md:px-4 pb-6 text-sm text-ink-soft max-w-4xl">Hours use scheduled shift times and recorded statuses. A completed status may be applied automatically and does not verify attendance or actual hours worked. Review and reconcile hours before payroll.</p>

      <TimesheetTable
        fromDate={fromDate}
        toDate={toDate}
        onFromChange={setFromDate}
        onToChange={setToDate}
      />
    </div>
  )
}
