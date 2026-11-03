import { createFileRoute } from '@tanstack/react-router'
import { WorkerAssignments } from '@/features/workers/components/WorkerAssignments'

export const Route = createFileRoute(
  '/_protected/dashboard/workers/$workerId/assignments',
)({ component: WorkerAssignments })
