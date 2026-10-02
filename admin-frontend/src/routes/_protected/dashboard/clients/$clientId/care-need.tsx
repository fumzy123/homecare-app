import {
  createFileRoute,
  Navigate,
  useRouterState,
} from '@tanstack/react-router'
import { WeeklyCareNeedEditor } from '@/features/weekly-care-need/components/WeeklyCareNeedEditor'
import { useClient } from '@/features/clients/hooks/useClients'
import { recordId } from '@/features/attention/search'
export const Route = createFileRoute(
  '/_protected/dashboard/clients/$clientId/care-need',
)({
  validateSearch: (
    s: Record<string, unknown>,
  ): { authorization?: string; need?: string } => ({
    authorization: recordId(s.authorization),
    need: recordId(s.need),
  }),
  component: CareNeed,
})
function CareNeed() {
  const { clientId } = Route.useParams()
  const { authorization, need } = Route.useSearch()
  const navigation = useRouterState({
    select: (s) => s.location.state.attentionNavigationId,
  })
  const client = useClient(clientId)
  if (authorization)
    return (
      <Navigate
        to="/dashboard/clients/$clientId/funding"
        params={{ clientId }}
        search={{ authorization }}
        replace
      />
    )
  return (
    <WeeklyCareNeedEditor
      key={`${clientId}:${need}:${navigation}`}
      clientId={clientId}
      enforceCompliance={client.data?.care_arrangement === 'funded'}
      attentionNeedId={need}
    />
  )
}
