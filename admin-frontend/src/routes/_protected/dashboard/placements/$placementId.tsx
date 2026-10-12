import { createFileRoute, useRouterState } from '@tanstack/react-router'
import { PlacementCoverage } from '@/features/placements/components/PlacementCoverage'
export const Route = createFileRoute('/_protected/dashboard/placements/$placementId')({ component: PlacementPage })
function PlacementPage() {
  const { placementId } = Route.useParams()
  const attentionNavigationId = useRouterState({ select: s => s.location.state.attentionNavigationId })
  return <PlacementCoverage key={`${placementId}:${attentionNavigationId}`} placementId={placementId} />
}
