import { createFileRoute } from '@tanstack/react-router'
import { ClientNotes } from '@/features/clients/components/ClientNotes'
export const Route = createFileRoute(
  '/_protected/dashboard/clients/$clientId/notes',
)({ component: Notes })
function Notes() {
  const { clientId } = Route.useParams()
  return <ClientNotes key={clientId} clientId={clientId} />
}
