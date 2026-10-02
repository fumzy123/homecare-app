import { createFileRoute } from '@tanstack/react-router'
import { ClientEdit } from '@/features/clients/components/ClientEdit'
export const Route = createFileRoute(
  '/_protected/dashboard/clients/$clientId/edit',
)({ component: Edit })
function Edit() {
  const { clientId } = Route.useParams()
  return <ClientEdit key={clientId} clientId={clientId} />
}
