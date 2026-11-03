import { createFileRoute } from '@tanstack/react-router'
import { WorkerAttendance } from '@/features/workers/components/WorkerAttendance'

export const Route = createFileRoute(
  '/_protected/dashboard/workers/$workerId/attendance',
)({
  validateSearch: (search: Record<string, unknown>): { section?: 'leave' } => ({
    section: search.section === 'leave' ? 'leave' : undefined,
  }),
  component: AttendancePage,
})
function AttendancePage() {
  const { section } = Route.useSearch()
  return <WorkerAttendance section={section} />
}
