import { createFileRoute } from '@tanstack/react-router'
import { ClientCareMetrics } from '@/features/clients/components/ClientCareMetrics'

export const Route = createFileRoute('/_protected/dashboard/clients/$clientId/visits')({
  component: ClientCareMetricsPage,
})

function ClientCareMetricsPage() {
  const { clientId } = Route.useParams()
  return <ClientCareMetrics clientId={clientId} />
}
