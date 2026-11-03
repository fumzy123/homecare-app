import { createFileRoute, useRouterState } from '@tanstack/react-router'
import { WorkerDocumentsTab } from '@/features/workers/components/WorkerDocumentsTab'
import { DOCUMENT_LABELS } from '@/features/workers/constants'
import { useWorkerProfileContext } from '@/features/workers/hooks/WorkerProfileContext'

export const Route = createFileRoute(
  '/_protected/dashboard/workers/$workerId/documents',
)({
  validateSearch: (search: Record<string, unknown>): { document?: string } => ({
    document:
      typeof search.document === 'string' &&
      Object.hasOwn(DOCUMENT_LABELS, search.document)
        ? search.document
        : undefined,
  }),
  component: DocumentsPage,
})
function DocumentsPage() {
  const { worker, today } = useWorkerProfileContext(),
    { document } = Route.useSearch()
  const navigationId = useRouterState({
    select: (s) => s.location.state.attentionNavigationId,
  })
  return (
    <WorkerDocumentsTab
      key={`${worker.id}:${navigationId}`}
      workerId={worker.id}
      today={today}
      initialDocumentType={document}
    />
  )
}
