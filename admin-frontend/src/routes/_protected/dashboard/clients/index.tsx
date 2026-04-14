import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Plus, LayoutList, LayoutGrid, Search } from 'lucide-react'
import { clientsApi, type ClientStatus } from '@/features/clients/api'
import { ClientCard } from '@/features/clients/components/ClientCard'
import { ClientTable } from '@/features/clients/components/ClientTable'
import { CreateClientDrawer } from '@/features/clients/components/CreateClientDrawer'

type ViewMode = 'table' | 'cards'

export const Route = createFileRoute('/_protected/dashboard/clients/')({
  component: ClientsPage,
})

const STATUS_OPTIONS: { value: ClientStatus | ''; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'discharged', label: 'Discharged' },
]

function ClientsPage() {
  const queryClient = useQueryClient()

  const [view, setView] = useState<ViewMode>('table')
  const [showDrawer, setShowDrawer] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ClientStatus | ''>('')

  const { data: clients = [], isLoading, isError } = useQuery({
    queryKey: ['clients', statusFilter],
    queryFn: () => clientsApi.listClients(statusFilter || undefined),
  })

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Clients</h1>
          {!isLoading && (
            <p className="mt-1 text-sm text-gray-500">
              {clients.length} {clients.length === 1 ? 'client' : 'clients'}
            </p>
          )}
        </div>
        <button
          onClick={() => setShowDrawer(true)}
          className="flex items-center gap-2 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
        >
          <Plus size={16} />
          New Client
        </button>
      </div>

      {/* Toolbar: search + status filter + view toggle */}
      <div className="mb-4 flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="w-full rounded-md border border-gray-300 py-2 pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
            placeholder="Search clients…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex rounded-md border border-gray-300 overflow-hidden">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value)}
              className={`px-3 py-2 text-xs font-medium transition-colors ${
                statusFilter === opt.value
                  ? 'bg-gray-900 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="ml-auto flex rounded-md border border-gray-300 overflow-hidden">
          <button
            onClick={() => setView('table')}
            title="Table view"
            className={`p-2 transition-colors ${
              view === 'table' ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
            }`}
          >
            <LayoutList size={15} />
          </button>
          <button
            onClick={() => setView('cards')}
            title="Card view"
            className={`p-2 transition-colors ${
              view === 'cards' ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
            }`}
          >
            <LayoutGrid size={15} />
          </button>
        </div>
      </div>

      {/* Content */}
      {isLoading && <p className="text-sm text-gray-500">Loading clients…</p>}

      {isError && <p className="text-sm text-red-500">Failed to load clients.</p>}

      {!isLoading && !isError && clients.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
          <p className="text-sm font-medium text-gray-900">No clients yet</p>
          <p className="mt-1 text-sm text-gray-500">Click New Client to add your first client.</p>
        </div>
      )}

      {!isLoading && !isError && clients.length > 0 && (
        <>
          {view === 'table' ? (
            <ClientTable clients={clients} globalFilter={search} />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {clients
                .filter((c) => {
                  if (!search) return true
                  const q = search.toLowerCase()
                  return (
                    c.first_name.toLowerCase().includes(q) ||
                    c.last_name.toLowerCase().includes(q) ||
                    c.email?.toLowerCase().includes(q) ||
                    c.city.toLowerCase().includes(q)
                  )
                })
                .map((client) => (
                  <ClientCard key={client.id} client={client} />
                ))}
            </div>
          )}
        </>
      )}

      {showDrawer && (
        <CreateClientDrawer
          onClose={() => setShowDrawer(false)}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ['clients'] })}
        />
      )}
    </div>
  )
}
