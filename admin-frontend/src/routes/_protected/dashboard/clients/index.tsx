import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import { Search } from 'lucide-react'
import { clientsApi, type ClientStatus, type Client, SERVICE_TYPE_LABELS } from '@/features/clients/api'
import { CreateClientDrawer } from '@/features/clients/components/CreateClientDrawer'
import { Avatar, Card, Kicker, StatusDot, Tag, Btn } from '@/shared/components/ui'

export const Route = createFileRoute('/_protected/dashboard/clients/')({
  component: ClientsPage,
})

const STATUS_OPTIONS: { value: ClientStatus | ''; label: string }[] = [
  { value: '',           label: 'All'        },
  { value: 'active',     label: 'Active'     },
  { value: 'on_hold',    label: 'On Hold'    },
  { value: 'discharged', label: 'Discharged' },
]

const AVATAR_COLORS = ['c1','c2','c3','c4','c5','c6'] as const

function ClientsPage() {
  const queryClient = useQueryClient()
  const [showDrawer, setShowDrawer]       = useState(false)
  const [search, setSearch]               = useState('')
  const [statusFilter, setStatusFilter]   = useState<ClientStatus | ''>('')

  const { data: clients = [], isLoading, isError } = useQuery({
    queryKey: ['clients', statusFilter],
    queryFn:  () => clientsApi.listClients(statusFilter || undefined),
  })

  const filtered = useMemo(() => {
    if (!search) return clients
    const q = search.toLowerCase()
    return clients.filter((c) =>
      `${c.first_name} ${c.last_name}`.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.city?.toLowerCase().includes(q)
    )
  }, [clients, search])

  return (
    <div className="min-h-full bg-cream">
      {/* Page header */}
      <div className="flex items-end justify-between max-md:flex-col max-md:items-start gap-4 px-10 max-md:px-4 pt-10 max-md:pt-6 pb-6">
        <div>
          <Kicker leader className="mb-4">03 / Profile Management - Clients</Kicker>
          <h1 className="font-serif text-[52px] max-md:text-[32px] leading-[0.98] font-medium tracking-[-0.02em]">
            Clients &{' '}
            <span className="font-serif italic text-muted">
              care plans.
            </span>
          </h1>
        </div>
        <Btn variant="ghost" onClick={() => setShowDrawer(true)}>＊ New client</Btn>
      </div>

      {/* Toolbar */}
      <div className="px-10 max-md:px-4 mb-6 flex items-center gap-3">
        {/* Search */}
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            className="bg-paper border border-ink pl-8 pr-3 py-2 font-mono text-[12px] text-ink placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-ink w-56"
            placeholder="Search clients…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Status filter pills */}
        <div className="flex items-center border border-ink overflow-hidden">
          {STATUS_OPTIONS.map((opt, i) => (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value)}
              className={`px-3 py-2 font-mono text-[10px] uppercase tracking-[0.08em] transition-colors ${
                i > 0 ? 'border-l border-ink' : ''
              } ${
                statusFilter === opt.value
                  ? 'bg-ink text-cream'
                  : 'bg-transparent text-ink-soft hover:bg-cream-2'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <span className="font-mono text-[10px] text-muted ml-auto tracking-wide">
          {filtered.length} RESULTS
        </span>
      </div>

      {/* Table */}
      <div className="px-10 max-md:px-4 pb-12">
        {isLoading && (
          <p className="font-mono text-[11px] text-muted tracking-wide py-8">LOADING CLIENTS…</p>
        )}
        {isError && (
          <p className="font-mono text-[11px] text-orange tracking-wide py-8">FAILED TO LOAD CLIENTS</p>
        )}

        {!isLoading && !isError && filtered.length === 0 && (
          <div className="border border-dashed border-ink p-16 text-center">
            <p className="font-serif text-[24px] mb-2">No clients found</p>
            <p className="font-mono text-[11px] text-muted tracking-wide">
              {search ? 'TRY A DIFFERENT SEARCH TERM' : 'CLICK NEW CLIENT TO ADD YOUR FIRST CLIENT'}
            </p>
          </div>
        )}

        {!isLoading && !isError && filtered.length > 0 && (
          <div className="overflow-x-auto">
            <Card className="p-0 min-w-[640px]">
              {/* Table header */}
              <div className="grid grid-cols-[40px_10fr_8fr_6fr_3fr_4fr] bg-ink border-b border-ink">
                {['#', 'Client', 'Location', 'Service', 'Status', 'Since'].map((h, i) => (
                  <div key={i} className="px-4 py-3 font-mono text-[10px] uppercase tracking-[0.1em] text-cream/80">
                    {h}
                  </div>
                ))}
              </div>

              {/* Rows */}
              {filtered.map((client, i) => (
                <ClientRow key={client.id} client={client} index={i} />
              ))}
            </Card>
          </div>
        )}
      </div>

      {showDrawer && (
        <CreateClientDrawer
          onClose={() => setShowDrawer(false)}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ['clients'] })}
        />
      )}
    </div>
  )
}

function ClientRow({ client, index }: { client: Client; index: number }) {
  const color = AVATAR_COLORS[index % AVATAR_COLORS.length]
  const initials = `${client.first_name[0]}${client.last_name[0]}`
  const age = client.date_of_birth
    ? new Date().getFullYear() - new Date(client.date_of_birth).getFullYear()
    : null

  return (
    <Link
      to="/dashboard/clients/$clientId"
      params={{ clientId: client.id } as never}
      className={`grid grid-cols-[40px_10fr_8fr_6fr_3fr_4fr] items-center transition-all hover:bg-cream-2 hover:z-10 relative ${
        index > 0 ? 'border-t border-dashed border-line-soft' : ''
      }`}
    >
      <div className="px-4 py-3.5 font-mono text-[10px] text-muted">
        {String(index + 1).padStart(2, '0')}
      </div>
      <div className="px-4 py-3.5 flex items-center gap-3">
        <Avatar initials={initials} color={color} />
        <div className="min-w-0">
          <p className="text-[13px] font-medium leading-snug">
            {client.first_name} {client.last_name}
          </p>
          {age && (
            <p className="font-mono text-[10px] text-ink-soft">
              age {age}
            </p>
          )}
        </div>
      </div>
      <div className="px-4 py-3.5 min-w-0">
        <p className="font-mono text-[11px] text-ink truncate">{client.street || '—'}</p>
        <p className="font-mono text-[10px] text-ink-soft truncate">
          {[client.city, client.province, client.postal_code].filter(Boolean).join(', ')}
        </p>
      </div>
      <div className="px-4 py-3.5">
        <Tag variant="default">{SERVICE_TYPE_LABELS[client.service_type] ?? client.service_type}</Tag>
      </div>
      <div className="px-4 py-3.5">
        <StatusDot status={client.status} />
      </div>
      <div className="px-4 py-3.5 font-mono text-[11px] text-ink-soft">
        {new Date(client.care_start_date).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}
      </div>
    </Link>
  )
}
