import { createFileRoute, useRouterState } from '@tanstack/react-router'
import { WeeklyCareNeedEditor } from '@/features/weekly-care-need/components/WeeklyCareNeedEditor'
import { recordId } from '@/features/attention/search'

export const Route = createFileRoute('/_protected/dashboard/clients/$clientId/care-need')({
  validateSearch: (s: Record<string, unknown>): { need?: string } => ({
    need: recordId(s.need),
  }),
  component: CareNeed,
})

function CareNeed() {
  const { clientId } = Route.useParams()
  const { need } = Route.useSearch()
  const navigation = useRouterState({ select: (s) => s.location.state.attentionNavigationId })
  return (
    <>
      <WeeklyCareNeedEditor key={`${clientId}:${need}:${navigation}`} clientId={clientId} attentionNeedId={need} />
    </>
  )
}
