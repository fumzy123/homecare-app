import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { clientsApi } from '@/features/clients/api'
import { ClientEditForm } from '@/features/clients/components/ClientEditForm'
import { ClientDangerZone } from '@/features/clients/components/ClientDangerZone'

export const Route = createFileRoute('/_protected/dashboard/clients/$clientId/edit')({
  component: ClientEditPage,
})

function ClientEditPage() {
  const { clientId } = Route.useParams()

  const { data: client, isLoading, isError } = useQuery({
    queryKey: ['client', clientId],
    queryFn:  () => clientsApi.getClient(clientId),
  })

  if (isLoading) return <div className="p-10 font-mono text-[11px] text-muted">Loading…</div>
  if (isError || !client) return <div className="p-10 font-mono text-[11px] text-orange">Failed to load client.</div>

  return (
    <div className="p-10 space-y-6">
      <Link to="/dashboard/clients/$clientId" params={{ clientId } as never}
        className="font-mono text-[10px] tracking-[0.08em] uppercase text-ink-soft hover:text-ink">
        ← Overview
      </Link>
      <div className="h-2" />
      <ClientEditForm clientId={clientId} client={client} />
      <ClientDangerZone clientId={clientId} />
    </div>
  )
}
