import { createFileRoute } from '@tanstack/react-router'
import { isValid, parseISO } from 'date-fns'
import { WorkerSchedule } from '@/features/workers/components/WorkerSchedule'

const validDate = (value: unknown) =>
  typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  isValid(parseISO(value))
    ? value
    : undefined
export const Route = createFileRoute(
  '/_protected/dashboard/workers/$workerId/schedule',
)({
  validateSearch: (
    search: Record<string, unknown>,
  ): { week?: string; day?: string } => ({
    week: validDate(search.week),
    day: validDate(search.day),
  }),
  component: SchedulePage,
})
function SchedulePage() {
  const search = Route.useSearch()
  return <WorkerSchedule {...search} />
}
