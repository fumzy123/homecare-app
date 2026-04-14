import { Link } from '@tanstack/react-router'
import { type Client, SERVICE_TYPE_LABELS } from '@/features/clients/api'
import { ClientStatusBadge } from '@/features/clients/components/ClientStatusBadge'

function getInitials(firstName: string, lastName: string) {
  return `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase()
}

export function ClientCard({ client }: { client: Client }) {
  const initials = getInitials(client.first_name, client.last_name)

  return (
    <Link
      to="/dashboard/clients/$clientId"
      params={{ clientId: client.id }}
      className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm flex flex-col gap-3 hover:shadow-md transition-shadow"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-sm font-semibold text-white">
          {initials}
        </div>
        <div className="min-w-0">
          <p className="truncate font-medium text-gray-900">
            {client.first_name} {client.last_name}
          </p>
          <p className="truncate text-sm text-gray-500">{SERVICE_TYPE_LABELS[client.service_type]}</p>
        </div>
        <div className="ml-auto shrink-0">
          <ClientStatusBadge status={client.status} />
        </div>
      </div>

      <div className="border-t border-gray-100 pt-3 grid grid-cols-2 gap-2 text-sm">
        <div>
          <p className="text-xs text-gray-400">Location</p>
          <p className="text-gray-700 truncate">{client.city}, {client.province}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Phone</p>
          <p className="text-gray-700 truncate">{client.phone_number ?? '—'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Care Start</p>
          <p className="text-gray-700">
            {new Date(client.care_start_date).toLocaleDateString('en-CA', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Worker</p>
          <p className="text-gray-700 truncate">
            {client.assigned_worker
              ? `${client.assigned_worker.first_name} ${client.assigned_worker.last_name}`
              : '—'}
          </p>
        </div>
      </div>
    </Link>
  )
}
