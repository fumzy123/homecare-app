import { createFileRoute } from '@tanstack/react-router'
import { ClientCareHoursReport } from '@/features/clients/components/ClientCareHoursReport'
import { ClientAuthorizationSection } from '@/features/authorizations/components/ClientAuthorizationSection'
import { CareScheduleEditor } from '@/features/authorizations/components/CareScheduleEditor'
import { ComplianceSummary } from '@/features/authorizations/components/ComplianceSummary'

export const Route = createFileRoute('/_protected/dashboard/clients/$clientId/care-hours')({
  component: ClientCareHours,
})

function ClientCareHours() {
  const { clientId } = Route.useParams()
  return (
    <div className="p-10 space-y-10">
      {/* What the funder approved */}
      <ClientAuthorizationSection clientId={clientId} />
      {/* The plan, and whether it fits */}
      <div className="space-y-3">
        <CareScheduleEditor clientId={clientId} />
        <ComplianceSummary clientId={clientId} />
      </div>
      {/* What was actually delivered */}
      <div className="border-t border-ink pt-10">
        <ClientCareHoursReport clientId={clientId} />
      </div>
    </div>
  )
}
