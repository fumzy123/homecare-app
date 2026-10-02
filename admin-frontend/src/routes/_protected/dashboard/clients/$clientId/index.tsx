import { createFileRoute } from '@tanstack/react-router'
import { ClientOverview } from '@/features/clients/components/ClientOverview'
export const Route = createFileRoute(
  '/_protected/dashboard/clients/$clientId/',
)({ component: Overview })
function Overview() {
  const { clientId } = Route.useParams()
  return <ClientOverview clientId={clientId} />
}
