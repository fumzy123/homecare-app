import { createFileRoute } from '@tanstack/react-router'
import { WorkerAttendanceReport } from '@/features/workers/components/WorkerAttendanceReport'

export const Route = createFileRoute('/_protected/dashboard/workers/$workerId/attendance')({
  component: WorkerAttendance,
})

function WorkerAttendance() {
  const { workerId } = Route.useParams()
  return (
    <div className="p-10">
      <WorkerAttendanceReport workerId={workerId} />
    </div>
  )
}
