import { createFileRoute, Link, Outlet, useRouterState } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { format } from 'date-fns'
import { clientsApi } from '@/features/clients/api'
import { Avatar } from '@/shared/components/ui'
import { PostPlacementDrawer } from '@/features/placements/components/PostPlacementDrawer'

export const Route = createFileRoute('/_protected/dashboard/clients/$clientId')({
  component: ClientLayout,
})

function ClientTabNav({ clientId, funded }: { clientId: string; funded: boolean }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const base = `/dashboard/clients/${clientId}`
  // The middle tab is the same route for both modes — only the label differs:
  // funded clients manage an authorized weekly care plan; self-pay clients a
  // plain weekly care plan.
  const tabs = [
    { label: 'Overview',                                                  to: '/dashboard/clients/$clientId' },
    { label: funded ? 'Authorized Weekly Care Plan' : 'Weekly Care Plan', to: '/dashboard/clients/$clientId/care-plan' },
    { label: 'Care Metrics',                                              to: '/dashboard/clients/$clientId/visits' },
    { label: 'Progress Notes',                                            to: '/dashboard/clients/$clientId/notes' },
  ] as const
  return (
    <div className="flex border-b border-ink bg-cream px-8">
      {tabs.map(({ label, to }) => {
        const href = to.replace('$clientId', clientId)
        const active = href === base
          ? pathname === base || pathname === `${base}/`
          : pathname === href
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
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const isEditMode = pathname === `/dashboard/clients/${clientId}/edit`

  const { data: client, isLoading, isError } = useQuery({
    queryKey: ['client', clientId],
    queryFn: () => clientsApi.getClient(clientId),
  })

  // Edit page renders its own full-page layout — skip the rail/tab wrapper
  if (isEditMode) return <Outlet />

  if (isLoading) return <div className="p-8 font-mono text-[11px] text-muted">Loading…</div>
  if (isError || !client) return <div className="p-8 font-mono text-[11px] text-orange">Client not found.</div>

  const initials = `${client.first_name[0] ?? ''}${client.last_name[0] ?? ''}`.toUpperCase()
  const age = client.date_of_birth
    ? new Date().getFullYear() - new Date(client.date_of_birth).getFullYear()
    : null

  const statusPill =
    client.status === 'active'   ? { cls: 'bg-mint text-ink border-ink', label: '● Active' } :
    client.status === 'on_hold'  ? { cls: 'border-ink text-ink-soft bg-paper', label: 'On Hold' } :
                                   { cls: 'border-line-soft text-muted bg-paper', label: 'Discharged' }

  return (
    <div className="flex min-h-full bg-cream">

      {/* ── Left: Profile rail ── */}
      <div className="w-72 shrink-0 border-r border-ink flex flex-col p-8 gap-[22px] sticky top-0 overflow-y-auto scrollbar-hide [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]" style={{ height: '100vh' }}>

        <Link to="/dashboard/clients" className="font-mono text-[10px] tracking-[0.08em] uppercase text-ink-soft hover:text-ink">
          ← Clients
        </Link>

        <div>
          <Avatar initials={initials} color="c2" size="xl" className="mb-5" />
          <h1 className="font-serif text-[34px] leading-[1.0] font-medium tracking-[-0.02em]">
            {client.first_name}<br />
            <em>{client.last_name}</em>
          </h1>
          <div className="mt-3">
            <span className={`inline-flex items-center font-mono text-[9px] tracking-[0.08em] uppercase whitespace-nowrap px-2.5 py-1 border ${statusPill.cls}`}>
              {statusPill.label}
            </span>
          </div>
        </div>

        <div className="space-y-3.5">
          {age !== null && (
            <div>
              <p className="font-mono text-[9px] tracking-[0.1em] uppercase text-ink-soft mb-0.5">Age</p>
              <p className="text-[13px]">{age} yrs · {format(new Date(client.date_of_birth), 'yyyy-MM-dd')}</p>
            </div>
          )}
          {client.phone_number && (
            <div>
              <p className="font-mono text-[9px] tracking-[0.1em] uppercase text-ink-soft mb-0.5">Phone</p>
              <p className="text-[13px] font-mono">{client.phone_number}</p>
            </div>
          )}
          <div>
            <p className="font-mono text-[9px] tracking-[0.1em] uppercase text-ink-soft mb-0.5">Location</p>
            <p className="text-[13px]">{client.city}, {client.province}</p>
          </div>
          {client.care_start && (
            <div>
              <p className="font-mono text-[9px] tracking-[0.1em] uppercase text-ink-soft mb-0.5">Care start</p>
              <p className="text-[13px] font-mono">{format(new Date(client.care_start), 'yyyy-MM-dd')}</p>
            </div>
          )}
        </div>

        <div className="border-t border-ink" />

        <Link
          to="/dashboard/clients/$clientId/edit"
          params={{ clientId } as never}
          className="flex items-center justify-center gap-2 rounded-full border border-ink px-4 py-2 font-mono text-[12px] tracking-[0.03em] hover:bg-ink hover:text-cream transition-colors"
        >
          Edit profile →
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
        <ClientTabNav clientId={clientId} funded={client.care_arrangement === 'funded'} />
        <Outlet />
      </div>
    </div>
  )
}
