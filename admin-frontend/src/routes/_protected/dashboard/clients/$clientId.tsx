import { createFileRoute, Link, Outlet } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Pencil } from 'lucide-react'
import { clientsApi } from '@/features/clients/api'

export const Route = createFileRoute('/_protected/dashboard/clients/$clientId')({
  component: ClientLayout,
})

function statusBadge(status: string) {
  switch (status) {
    case 'active':     return 'bg-green-50 text-green-700'
    case 'on_hold':    return 'bg-amber-50 text-amber-700'
    case 'discharged': return 'bg-gray-100 text-gray-500'
    default:           return 'bg-gray-100 text-gray-500'
  }
}

function statusLabel(status: string) {
  if (status === 'on_hold') return 'On Hold'
  return status.charAt(0).toUpperCase() + status.slice(1)
}

function ClientLayout() {
  const { clientId } = Route.useParams()

  const { data: client, isLoading, isError } = useQuery({
    queryKey: ['client', clientId],
    queryFn: () => clientsApi.getClient(clientId),
  })

  if (isLoading) {
    return <div className="p-8 text-sm text-gray-500">Loading…</div>
  }

  if (isError || !client) {
    return (
      <div className="p-8">
        <p className="text-sm text-red-500">Failed to load client.</p>
        <Link to="/dashboard/clients" className="mt-2 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft size={14} /> Back to Clients
        </Link>
      </div>
    )
  }

  const initials = `${client.first_name[0] ?? ''}${client.last_name[0] ?? ''}`.toUpperCase()

  return (
    <div className="p-8 max-w-5xl">
      {/* Back */}
      <Link
        to="/dashboard/clients"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft size={14} />
        Clients
      </Link>

      {/* Header */}
      <div className="mt-4 mb-8 flex items-center gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-lg font-semibold text-white">
          {initials}
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            {client.first_name} {client.last_name}
          </h1>
          <p className="text-sm text-gray-500">{client.city}, {client.province}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusBadge(client.status)}`}>
          {statusLabel(client.status)}
        </span>
        <Link
          to="/dashboard/clients/$clientId/edit"
          params={{ clientId }}
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
