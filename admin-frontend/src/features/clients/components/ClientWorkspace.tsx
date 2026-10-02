import { useState } from 'react'
import { Link, Outlet, useRouterState } from '@tanstack/react-router'
import { differenceInYears, parseISO } from 'date-fns'
import { ChevronRight, Pencil, Plus, ShieldCheck } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { Avatar, StatusDot } from '@/shared/components/ui'
import { CreateShiftDrawer } from '@/features/shifts/components/CreateShiftDrawer'
import { useClient } from '../hooks/useClients'
import { ClientLoading } from './ClientWorkspaceUI'
import '../client-workspace.css'

const tabs = [
  ['Overview', '/dashboard/clients/$clientId'],
  ['Visits & metrics', '/dashboard/clients/$clientId/visits'],
  ['Weekly care need', '/dashboard/clients/$clientId/care-need'],
  ['Funding', '/dashboard/clients/$clientId/funding'],
  ['Progress notes', '/dashboard/clients/$clientId/notes'],
] as const

export function ClientWorkspace({ clientId }: { clientId: string }) {
  const query = useClient(clientId)
  const qc = useQueryClient()
  const [scheduling, setScheduling] = useState(false)
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  if (pathname.endsWith('/edit'))
    return (
      <div className="client-workspace cw-page">
        <Outlet />
      </div>
    )
  if (query.isPending || query.isError || !query.data)
    return (
      <div className="client-workspace cw-page">
        <ClientLoading
          error={query.isError}
          retry={() => void query.refetch()}
        />
      </div>
    )
  const client = query.data
  return (
    <div className="client-workspace cw-page">
      <nav aria-label="Breadcrumb" className="cw-breadcrumb">
        <Link to="/dashboard/clients">Clients</Link>
        <ChevronRight size={13} />
        <span>
          {client.first_name} {client.last_name}
        </span>
      </nav>
      <header className="cw-between">
        <div className="cw-identity">
          <Avatar
            initials={`${client.first_name[0]}${client.last_name[0]}`}
            color="c2"
            size="xl"
          />
          <div>
            <h1>
              {client.first_name} <em>{client.last_name}</em>
            </h1>
            <div className="cw-row cw-muted mt-3">
              <StatusDot status={client.status} />
              <span>·</span>
              <span>
                {differenceInYears(new Date(), parseISO(client.date_of_birth))}{' '}
                years
              </span>
              <span>·</span>
              <span>
                {client.city}, {client.province}
              </span>
              <span>·</span>
              <span>
                {client.care_arrangement === 'funded'
                  ? 'Funded care'
                  : 'Self-pay care'}
              </span>
            </div>
          </div>
        </div>
        <div className="cw-row cw-header-actions">
          <Link
            className="cw-btn"
            to="/dashboard/clients/$clientId/edit"
            params={{ clientId }}
          >
            Edit profile <Pencil size={14} />
          </Link>
          <button
            className="cw-btn cw-btn-primary"
            onClick={() => setScheduling(true)}
          >
            <Plus size={15} /> Schedule visit
          </button>
        </div>
      </header>
      <div className="cw-essentials">
        <ShieldCheck size={15} />
        <span>Care essentials</span>
        {client.allergies && (
          <span className="text-orange">Allergies: {client.allergies}</span>
        )}
        {client.medical_conditions && <span>{client.medical_conditions}</span>}
        {!client.allergies && !client.medical_conditions && (
          <span className="cw-muted">No care alerts recorded</span>
        )}
      </div>
      <nav className="cw-tabs" aria-label="Client pages">
        {tabs.map(([label, to]) => (
          <Link
            key={to}
            to={to}
            params={{ clientId }}
            activeOptions={{ exact: true }}
            aria-current={
              pathname.replace(/\/$/, '') ===
              to.replace('$clientId', clientId).replace(/\/$/, '')
                ? 'page'
                : undefined
            }
          >
            {label}
          </Link>
        ))}
      </nav>
      <Outlet />
      {scheduling && (
        <CreateShiftDrawer
          preselectedClientId={clientId}
          onClose={() => setScheduling(false)}
          onSuccess={() => {
            setScheduling(false)
            void qc.invalidateQueries({ queryKey: ['shifts'] })
            void qc.invalidateQueries({ queryKey: ['client', clientId] })
          }}
        />
      )}
    </div>
  )
}
