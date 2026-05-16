import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { ClientStatsSection, type Period, PERIODS } from '@/features/clients/components/ClientStatsSection'
import { ClientVisitHistory } from '@/features/clients/components/ClientVisitHistory'

export const Route = createFileRoute('/_protected/dashboard/clients/$clientId/')({
  component: ClientOverview,
})

function ClientOverview() {
  const { clientId } = Route.useParams()
  const [period, setPeriod] = useState<Period>('this_week')

  return (
    <div className="p-10 space-y-8">
      <ClientStatsSection clientId={clientId} period={period} onPeriodChange={setPeriod} />
      <ClientVisitHistory clientId={clientId} period={period} />
    </div>
  )
}
