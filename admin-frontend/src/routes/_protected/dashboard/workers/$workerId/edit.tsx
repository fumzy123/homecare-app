import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { orgMembersApi } from '@/features/org-members/api'
import { WorkerPersonalInfoForm } from '@/features/workers/components/WorkerPersonalInfoForm'
import { WorkerEmploymentForm } from '@/features/workers/components/WorkerEmploymentForm'
import { WorkerDangerZone } from '@/features/workers/components/WorkerDangerZone'
import { WorkerDocumentsTab } from '@/features/workers/components/WorkerDocumentsTab'

export const Route = createFileRoute('/_protected/dashboard/workers/$workerId/edit')({
  component: WorkerEditPage,
})

function WorkerEditPage() {
  const { workerId } = Route.useParams()

  const { data: worker, isLoading, isError } = useQuery({
    queryKey: ['worker', workerId],
    queryFn: () => orgMembersApi.getOrgMember(workerId),
  })

  if (isLoading) return <div className="p-10 font-mono text-[11px] text-muted">Loading…</div>
  if (isError || !worker) return <div className="p-10 font-mono text-[11px] text-orange">Worker not found.</div>

  return (
    <div className="p-10 space-y-6">
      <div className="h-2" />
      <WorkerPersonalInfoForm worker={worker} />
      <WorkerEmploymentForm worker={worker} />
      <WorkerDocumentsTab workerId={workerId} />
      <WorkerDangerZone worker={worker} />
    </div>
  )
}
