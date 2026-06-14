import { createFileRoute } from '@tanstack/react-router'
import { ClientCareHoursReport } from '@/features/clients/components/ClientCareHoursReport'
import { ClientAuthorizationSection } from '@/features/authorizations/components/ClientAuthorizationSection'
import { CareScheduleEditor } from '@/features/authorizations/components/CareScheduleEditor'

export const Route = createFileRoute('/_protected/dashboard/clients/$clientId/care-hours')({
  component: ClientCareHours,
})

function ClientCareHours() {
  const { clientId } = Route.useParams()
  return (
    <div className="p-10 space-y-10">
      <ClientAuthorizationSection clientId={clientId} />
      <CareScheduleEditor clientId={clientId} />
      <div className="border-t border-ink pt-10">
        <ClientCareHoursReport clientId={clientId} />
      </div>
    </div>
  )
}
