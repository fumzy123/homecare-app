import { createFileRoute, Link, Outlet } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Pencil } from 'lucide-react'
import { workersApi } from '@/features/workers/api'

export const Route = createFileRoute('/_protected/dashboard/workers/$workerId')({
  component: WorkerLayout,
})

function WorkerLayout() {
  const { workerId } = Route.useParams()

  const { data: worker, isLoading, isError } = useQuery({
    queryKey: ['worker', workerId],
    queryFn: () => workersApi.getWorker(workerId),
  })

  if (isLoading) {
    return <div className="p-8 text-sm text-gray-500">Loading…</div>
  }

  if (isError || !worker) {
    return <div className="p-8 text-sm text-red-500">Worker not found.</div>
  }

  const initials = `${worker.first_name[0] ?? ''}${worker.last_name[0] ?? ''}`.toUpperCase()

  return (
    <div className="p-8 max-w-5xl">
      {/* Back */}
      <Link
        to="/dashboard/workers"
        className="mb-6 flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900"
      >
        <ArrowLeft size={14} />
        Workers
      </Link>

      {/* Header */}
      <div className="mb-8 flex items-center gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gray-900 text-lg font-semibold text-white">
          {initials}
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            {worker.first_name} {worker.last_name}
          </h1>
          <p className="text-sm text-gray-500">{worker.email}</p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            worker.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
          }`}
        >
          {worker.is_active ? 'Active' : 'Inactive'}
        </span>
        <Link
          to="/dashboard/workers/$workerId/edit"
          params={{ workerId }}
          className="ml-auto flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <Pencil size={14} />
          Edit Profile
        </Link>
      </div>

      <Outlet />
    </div>
  )
}
