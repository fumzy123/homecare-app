import { createFileRoute } from '@tanstack/react-router'
import { ClientCareHoursReport } from '@/features/clients/components/ClientCareHoursReport'

export const Route = createFileRoute('/_protected/dashboard/clients/$clientId/care-hours')({
  component: ClientCareHours,
})

function ClientCareHours() {
  const { clientId } = Route.useParams()
  return (
    <div className="p-10">
      <ClientCareHoursReport clientId={clientId} />
    </div>
  )
}
