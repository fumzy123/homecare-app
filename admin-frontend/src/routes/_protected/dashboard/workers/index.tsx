import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { workersApi } from '@/features/workers/api'
import { WorkerCard } from '@/features/workers/components/WorkerCard'

export const Route = createFileRoute('/_protected/dashboard/workers/')({
  component: WorkersPage,
})

function WorkersPage() {
  const { data: workers = [], isLoading, isError } = useQuery({
    queryKey: ['workers'],
    queryFn: workersApi.listWorkers,
  })

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Workers</h1>
          {!isLoading && (
            <p className="mt-1 text-sm text-gray-500">
              {workers.length} {workers.length === 1 ? 'worker' : 'workers'}
            </p>
          )}
        </div>
      </div>

      {isLoading && (
        <p className="text-sm text-gray-500">Loading workers...</p>
      )}

      {isError && (
        <p className="text-sm text-red-500">Failed to load workers.</p>
      )}

      {!isLoading && !isError && workers.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
          <p className="text-sm font-medium text-gray-900">No workers yet</p>
          <p className="mt-1 text-sm text-gray-500">
            Invite workers from the Team page to get started.
          </p>
        </div>
      )}

      {workers.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {workers.map((worker) => (
            <WorkerCard key={worker.id} worker={worker} />
          ))}
        </div>
      )}
    </div>
  )
}
