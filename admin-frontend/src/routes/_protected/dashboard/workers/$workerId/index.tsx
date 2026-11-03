import { createFileRoute } from '@tanstack/react-router'
import { WorkerOverview } from '@/features/workers/components/WorkerOverview'

export const Route = createFileRoute(
  '/_protected/dashboard/workers/$workerId/',
)({ component: WorkerOverview })
