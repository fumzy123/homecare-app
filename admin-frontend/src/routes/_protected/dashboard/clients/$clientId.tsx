import { createFileRoute } from '@tanstack/react-router'
import { ClientWorkspace } from '@/features/clients/components/ClientWorkspace'
export const Route = createFileRoute('/_protected/dashboard/clients/$clientId')(
  { component: ClientLayout },
)
function ClientLayout() {
  const { clientId } = Route.useParams()
  return <ClientWorkspace key={clientId} clientId={clientId} />
}
