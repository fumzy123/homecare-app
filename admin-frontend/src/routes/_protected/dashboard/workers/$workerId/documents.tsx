import { createFileRoute } from '@tanstack/react-router'
import { WorkerDocumentsTab } from '@/features/workers/components/WorkerDocumentsTab'

export const Route = createFileRoute('/_protected/dashboard/workers/$workerId/documents')({
  component: DocumentsPage,
})

function DocumentsPage() {
  const { workerId } = Route.useParams()
  return <WorkerDocumentsTab workerId={workerId} />
}
