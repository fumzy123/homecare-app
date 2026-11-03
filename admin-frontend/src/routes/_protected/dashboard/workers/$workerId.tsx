import { createFileRoute } from '@tanstack/react-router'
import { WorkerWorkspace } from '@/features/workers/components/WorkerWorkspace'

export const Route = createFileRoute('/_protected/dashboard/workers/$workerId')(
  { component: WorkerLayout },
)
function WorkerLayout() {
  const { workerId } = Route.useParams()
  return <WorkerWorkspace key={workerId} workerId={workerId} />
}
