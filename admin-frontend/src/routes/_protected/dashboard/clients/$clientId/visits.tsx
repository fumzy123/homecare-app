import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { ClientCareMetrics } from '@/features/clients/components/ClientCareMetrics'

export const Route = createFileRoute('/_protected/dashboard/clients/$clientId/visits')({
  validateSearch: z.object({ week: z.iso.date().optional().catch(undefined) }),
  component: ClientCareMetricsPage,
})

function ClientCareMetricsPage() {
  const { clientId } = Route.useParams()
  const { week } = Route.useSearch()
  return <ClientCareMetrics key={`${clientId}:${week || ''}`} clientId={clientId} initialDate={week} />
}
