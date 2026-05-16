import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { WorkerStatsSection } from '@/features/workers/components/WorkerStatsSection'
import { type Period } from '@/features/shifts/utils/period'
import { WorkerShiftHistory } from '@/features/workers/components/WorkerShiftHistory'

export const Route = createFileRoute('/_protected/dashboard/workers/$workerId/')({
  component: WorkerOverview,
})

function WorkerOverview() {
  const { workerId } = Route.useParams()
  const [period, setPeriod] = useState<Period>('this_week')

  return (
    <div className="p-10 space-y-8">
      <WorkerStatsSection workerId={workerId} period={period} onPeriodChange={setPeriod} />
      <WorkerShiftHistory workerId={workerId} period={period} />
    </div>
  )
}
