import { createFileRoute } from '@tanstack/react-router'
import { ClientOverviewTab } from '@/features/clients/components/ClientOverviewTab'

export const Route = createFileRoute('/_protected/dashboard/clients/$clientId/')({
  component: ClientOverview,
})

function ClientOverview() {
  const { clientId } = Route.useParams()
  return <ClientOverviewTab clientId={clientId} />
}
