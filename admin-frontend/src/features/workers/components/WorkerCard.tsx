import { Link } from '@tanstack/react-router'
import { type Worker } from '@/features/workers/api'

function getInitials(firstName: string, lastName: string) {
  return `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase()
}

export function WorkerCard({ worker }: { worker: Worker }) {
  const initials = getInitials(worker.first_name, worker.last_name)

  return (
    <Link
      to="/dashboard/workers/$workerId"
      params={{ workerId: worker.id }}
      className="block rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-900 text-sm font-semibold text-white">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="truncate font-medium text-gray-900">
              {worker.first_name} {worker.last_name}
            </p>
            <p className="truncate text-sm text-gray-500">{worker.email}</p>
          </div>
          <span
            className={`ml-auto shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
              worker.is_active
                ? 'bg-green-50 text-green-700'
                : 'bg-gray-100 text-gray-500'
            }`}
          >
            {worker.is_active ? 'Active' : 'Inactive'}
          </span>
        </div>

        <div className="border-t border-gray-100 pt-3 grid grid-cols-2 gap-2 text-sm">
          <div>
            <p className="text-xs text-gray-400">Phone</p>
            <p className="text-gray-700 truncate">{worker.phone_number ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Hire Date</p>
            <p className="text-gray-700">
              {worker.hire_date
                ? new Date(worker.hire_date).toLocaleDateString('en-CA', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })
                : '—'}
            </p>
          </div>
        </div>
      </div>
    </Link>
  )
}
