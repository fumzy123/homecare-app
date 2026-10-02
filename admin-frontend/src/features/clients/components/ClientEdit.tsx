import { Link, useNavigate } from '@tanstack/react-router'
import { useClient } from '../hooks/useClients'
import { ClientLoading } from './ClientWorkspaceUI'
import { ClientProfileForm } from './ClientProfileForm'
export function ClientEdit({ clientId }: { clientId: string }) {
  const client = useClient(clientId)
  const navigate = useNavigate()
  const back = () =>
    void navigate({ to: '/dashboard/clients/$clientId', params: { clientId } })
  if (!client.data)
    return (
      <ClientLoading
        error={client.isError}
        retry={() => void client.refetch()}
      />
    )
  return (
    <div className="max-w-5xl mx-auto">
      <Link
        className="cw-link mb-6"
        to="/dashboard/clients/$clientId"
        params={{ clientId }}
      >
        ← {client.data.first_name} {client.data.last_name}
      </Link>
      <header className="mb-7">
        <p className="cw-label mb-3">Client profile</p>
        <h1>The details that make care personal.</h1>
      </header>
      <ClientProfileForm
        client={client.data}
        onCancel={back}
        onSuccess={back}
      />
    </div>
  )
}
