import { createFileRoute, redirect } from '@tanstack/react-router'
import { WorkerProfileEditor } from '@/features/workers/components/WorkerProfileEditor'
import { DOCUMENT_LABELS } from '@/features/workers/constants'

export const Route = createFileRoute(
  '/_protected/dashboard/workers/$workerId/edit',
)({
  validateSearch: (search: Record<string, unknown>): { document?: string } => ({
    document:
      typeof search.document === 'string' &&
      Object.hasOwn(DOCUMENT_LABELS, search.document)
        ? search.document
        : undefined,
  }),
  beforeLoad: ({ params, search }) => {
    if (search.document)
      throw redirect({
        to: '/dashboard/workers/$workerId/documents',
        params,
        search: { document: search.document },
        replace: true,
      })
  },
  component: EditPage,
})
function EditPage() {
  const { workerId } = Route.useParams()
  return <WorkerProfileEditor workerId={workerId} />
}
