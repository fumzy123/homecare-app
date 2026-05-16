import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { Download } from 'lucide-react'
import { Kicker, Btn } from '@/shared/components/ui'
import { TimesheetTable } from '@/features/shifts/components/TimesheetTable'
import { exportCsv, useTimesheetDefaults } from '@/features/shifts/utils/timesheet'
import { shiftsApi } from '@/features/shifts/api'
import { useQuery } from '@tanstack/react-query'

export const Route = createFileRoute('/_protected/dashboard/timesheet/')({
  component: TimesheetPage,
})

function TimesheetPage() {
  const { fromDate: defaultFrom, toDate: defaultTo } = useTimesheetDefaults()
  const [fromDate, setFromDate] = useState(defaultFrom)
  const [toDate, setToDate]     = useState(defaultTo)

  const { data: shifts = [] } = useQuery({
    queryKey: ['shifts', fromDate || '2020-01-01', toDate || '2030-12-31', '', '', ['completed', 'no_show', 'cancelled']],
    queryFn:  () => shiftsApi.listShifts(fromDate || '2020-01-01', toDate || '2030-12-31', undefined, undefined, ['completed', 'no_show', 'cancelled']),
  })

  return (
    <div className="min-h-full bg-cream flex flex-col">
      <div className="flex shrink-0 flex-wrap items-end justify-between gap-y-5 gap-x-4 px-10 max-md:px-4 pt-10 max-md:pt-6 pb-6">
        <div>
          <Kicker leader className="mb-4">05 / Timesheets</Kicker>
          <h1 className="font-serif text-[52px] max-md:text-[36px] leading-[0.98] font-medium tracking-[-0.02em]">
            Timesheets{' '}
            <span className="font-serif italic text-muted">— payroll record</span>
          </h1>
        </div>
        <Btn variant="ghost" onClick={() => exportCsv(shifts, fromDate, toDate)} disabled={shifts.length === 0} className="max-sm:w-full max-sm:justify-center">
          <Download size={14} />
          Export CSV
        </Btn>
      </div>

      <TimesheetTable
        fromDate={fromDate}
        toDate={toDate}
        onFromChange={setFromDate}
        onToChange={setToDate}
      />
    </div>
  )
}
