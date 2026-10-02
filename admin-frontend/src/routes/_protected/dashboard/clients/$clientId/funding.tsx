import { createFileRoute, useRouterState } from '@tanstack/react-router'
import { ClientFunding } from '@/features/clients/components/ClientFunding'
import { recordId } from '@/features/attention/search'
export const Route = createFileRoute(
  '/_protected/dashboard/clients/$clientId/funding',
)({
  validateSearch: (s: Record<string, unknown>): { authorization?: string } => ({
    authorization: recordId(s.authorization),
  }),
  component: Funding,
})
function Funding() {
  const { clientId } = Route.useParams()
  const { authorization } = Route.useSearch()
  const navigation = useRouterState({
    select: (s) => s.location.state.attentionNavigationId,
  })
  return (
    <ClientFunding
      key={`${clientId}:${authorization}:${navigation}`}
      clientId={clientId}
      attentionAuthorization={authorization}
    />
  )
}
