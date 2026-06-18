import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { WorkerStatsSection } from '@/features/workers/components/WorkerStatsSection'
import { WorkerShiftHistory } from '@/features/workers/components/WorkerShiftHistory'
import { WorkerTopClients } from '@/features/workers/components/WorkerTopClients'
import { WorkerOvertimeSection } from '@/features/workers/components/WorkerOvertimeSection'
import { type Period } from '@/features/shifts/utils/period'

export const Route = createFileRoute('/_protected/dashboard/workers/$workerId/')({
  component: WorkerOverview,
})

function WorkerOverview() {
  const { workerId } = Route.useParams()
  const [period, setPeriod] = useState<Period>('this_week')

  return (
    <div className="p-10 space-y-8">
      <WorkerStatsSection workerId={workerId} period={period} onPeriodChange={setPeriod} />
      <WorkerOvertimeSection workerId={workerId} period={period} />
      <div className="flex flex-col lg:flex-row gap-8 items-start">
        <div className="flex-1 min-w-0">
          <WorkerShiftHistory workerId={workerId} period={period} />
        </div>
        <div className="w-full lg:w-80 shrink-0">
          <WorkerTopClients workerId={workerId} period={period} />
        </div>
      </div>
    </div>
  )
}
