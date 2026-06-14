import { createFileRoute, Link, Outlet, useRouterState } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { format } from 'date-fns'
import { clientsApi, SERVICE_TYPE_LABELS } from '@/features/clients/api'
import { Avatar } from '@/shared/components/ui'
import { PostPlacementDrawer } from '@/features/placements/components/PostPlacementDrawer'

export const Route = createFileRoute('/_protected/dashboard/clients/$clientId')({
  component: ClientLayout,
})

const TABS = [
  { label: 'Visits',      to: '/dashboard/clients/$clientId' },
  { label: 'Notes',       to: '/dashboard/clients/$clientId/notes' },
  { label: 'Care Hours',  to: '/dashboard/clients/$clientId/care-hours' },
] as const

function ClientTabNav({ clientId }: { clientId: string }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  return (
    <div className="flex border-b border-ink bg-cream px-8">
      {TABS.map(({ label, to }) => {
        const href = to.replace('$clientId', clientId)
        const active = pathname === href || (label === 'Visits' && pathname === href.replace(/\/$/, ''))
        return (
          <Link
            key={label}
            to={to}
            params={{ clientId } as never}
            className={`px-4 py-3 font-mono text-[10px] tracking-[0.08em] uppercase border-b-2 transition-colors ${
              active ? 'border-ink text-ink' : 'border-transparent text-ink-soft hover:text-ink'
            }`}
          >
            {label}
          </Link>
        )
      })}
    </div>
  )
}

function ClientLayout() {
  const { clientId } = Route.useParams()
  const [showPlacementDrawer, setShowPlacementDrawer] = useState(false)

  const { data: client, isLoading, isError } = useQuery({
    queryKey: ['client', clientId],
    queryFn: () => clientsApi.getClient(clientId),
  })

  if (isLoading) return <div className="p-8 font-mono text-[11px] text-muted">Loading…</div>
  if (isError || !client) return <div className="p-8 font-mono text-[11px] text-orange">Client not found.</div>

  const initials = `${client.first_name[0] ?? ''}${client.last_name[0] ?? ''}`.toUpperCase()
  const age = client.date_of_birth
    ? new Date().getFullYear() - new Date(client.date_of_birth).getFullYear()
    : null

  return (
    <div className="flex min-h-full bg-cream">

      {/* ── Left: Profile card ── */}
      <div className="w-72 shrink-0 border-r border-ink flex flex-col p-8 gap-6 sticky top-0 overflow-hidden" style={{ height: '100vh' }}>

        <Link to="/dashboard/clients" className="font-mono text-[10px] tracking-[0.08em] uppercase text-ink-soft hover:text-ink">
          ← Clients
        </Link>

        <div>
          <Avatar initials={initials} color="c2" size="xl" className="mb-5" />
          <h1 className="font-serif text-[34px] leading-[1.0] font-medium tracking-[-0.02em]">
            {client.first_name}<br />
            <em>{client.last_name}</em>
          </h1>
          {client.service_types.length > 0 && (
            <p className="font-mono text-[10px] tracking-[0.12em] uppercase text-ink-soft mt-2">
              {client.service_types.map((t) => SERVICE_TYPE_LABELS[t]).join(' · ')}
            </p>
          )}
          <span className={`mt-3 inline-block font-mono text-[9px] tracking-[0.1em] uppercase px-2.5 py-1 border ${
            client.status === 'active'     ? 'bg-ink text-cream border-ink' :
            client.status === 'on_hold'    ? 'border-ink text-ink-soft' :
                                             'border-line-soft text-muted'
          }`}>
            {client.status === 'on_hold' ? 'On Hold' : client.status.charAt(0).toUpperCase() + client.status.slice(1)}
          </span>
        </div>

        <div className="border-t border-ink" />

        <div className="space-y-4">
          {age !== null && (
            <div>
              <p className="font-mono text-[9px] tracking-[0.1em] uppercase text-ink-soft mb-0.5">Age</p>
              <p className="text-[13px]">{age} yrs · {format(new Date(client.date_of_birth), 'yyyy-MM-dd')}</p>
            </div>
          )}
          {client.phone_number && (
            <div>
              <p className="font-mono text-[9px] tracking-[0.1em] uppercase text-ink-soft mb-0.5">Phone</p>
              <p className="text-[13px]">{client.phone_number}</p>
            </div>
          )}
          {client.email && (
            <div>
              <p className="font-mono text-[9px] tracking-[0.1em] uppercase text-ink-soft mb-0.5">Email</p>
              <p className="text-[12px] break-all">{client.email}</p>
            </div>
          )}
          <div>
            <p className="font-mono text-[9px] tracking-[0.1em] uppercase text-ink-soft mb-0.5">Location</p>
            <p className="text-[13px]">{client.city}, {client.province}</p>
          </div>
          {client.care_start && (
            <div>
              <p className="font-mono text-[9px] tracking-[0.1em] uppercase text-ink-soft mb-0.5">Care Start</p>
              <p className="text-[13px]">{format(new Date(client.care_start), 'yyyy-MM-dd')}</p>
            </div>
          )}
          {client.coverage === 'lapsed' && (
            <div>
              <p className="font-mono text-[9px] tracking-[0.1em] uppercase text-orange mb-0.5">⚠ Coverage</p>
              <p className="text-[13px] text-orange">No active authorization</p>
            </div>
          )}
        </div>

        <div className="border-t border-ink" />

        <Link
          to="/dashboard/clients/$clientId/edit"
          params={{ clientId } as never}
          className="font-mono text-[10px] tracking-[0.05em] uppercase text-ink-soft hover:text-ink"
        >
          Edit →
        </Link>

        <button
          onClick={() => setShowPlacementDrawer(true)}
          className="w-full bg-ink text-cream px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.06em] hover:bg-orange transition-colors text-left"
        >
          ＊ Post as Available
        </button>
      </div>

      {showPlacementDrawer && (
        <PostPlacementDrawer
          clients={client ? [{ id: client.id, first_name: client.first_name, last_name: client.last_name }] : []}
          preselectedClientId={clientId}
          onClose={() => setShowPlacementDrawer(false)}
        />
      )}

      {/* ── Right: Tab nav + content ── */}
      <div className="flex-1 min-w-0 flex flex-col">
        <ClientTabNav clientId={clientId} />
        <Outlet />
      </div>
    </div>
  )
}
