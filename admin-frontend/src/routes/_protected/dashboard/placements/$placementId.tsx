import { createFileRoute } from '@tanstack/react-router'
import { PlacementCoverage } from '@/features/placements/components/PlacementCoverage'
export const Route = createFileRoute('/_protected/dashboard/placements/$placementId')({ component: PlacementPage })
function PlacementPage() {
  const { placementId } = Route.useParams()
  return <PlacementCoverage placementId={placementId} />
}
