import { useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Plus, Search } from 'lucide-react'
import { differenceInYears, format, parseISO } from 'date-fns'
import { Avatar, StatusDot } from '@/shared/components/ui'
import { fmtHours } from '@/features/weekly-care-need/utils'
import { useClients } from '../hooks/useClients'
import { CreateClientDrawer } from './CreateClientDrawer'
import { ClientEmpty, ClientLoading, ClientBadge } from './ClientWorkspaceUI'
import '../client-workspace.css'

export function ClientDirectory() {
  const query = useClients()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [creating, setCreating] = useState(false)
  const filtered = useMemo(
    () =>
      (query.data || []).filter(
        (c) =>
          (!status || c.status === status) &&
          `${c.first_name} ${c.last_name} ${c.city} ${c.email || ''}`
            .toLowerCase()
            .includes(search.toLowerCase()),
      ),
    [query.data, status, search],
  )
  return (
    <div className="client-workspace cw-page">
      <header className="cw-between mb-8">
        <div>
          <p className="cw-label mb-4">03 / Client workspace</p>
          <h1>
            Clients & <em className="text-muted">weekly care requests.</em>
          </h1>
        </div>
        <button
          className="cw-btn cw-btn-primary"
          onClick={() => setCreating(true)}
        >
          <Plus size={15} /> New client
        </button>
      </header>
      <div className="cw-toolbar">
        <div className="cw-row">
          <div className="cw-search">
            <Search size={16} />
            <input
              className="cw-input"
              aria-label="Search clients"
              placeholder="Search clients…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="cw-segments">
            {[
              ['', 'All'],
              ['active', 'Active'],
              ['on_hold', 'On hold'],
              ['discharged', 'Discharged'],
            ].map(([value, label]) => (
              <button
                key={value}
                aria-pressed={status === value}
                onClick={() => setStatus(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <span className="cw-label">{filtered.length} clients</span>
      </div>
      {query.isPending || query.isError ? (
        <ClientLoading
          error={query.isError}
          retry={() => void query.refetch()}
        />
      ) : !filtered.length ? (
        <ClientEmpty title="No clients found">
          {search
            ? 'Try another name or location.'
            : 'Add a client to start their care record.'}
        </ClientEmpty>
      ) : (
        <div className="cw-table-scroll">
          <table className="cw-table">
            <thead>
              <tr>
                {[
                  'Client',
                  'Age',
                  'Location',
                  'Weekly care',
                  'Coverage',
                  'Status',
                ].map((h, i) => (
                  <th key={i}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => {
                const care = c.directory_care
                const openSlots = care && care.covered_slot_count !== null
                  ? care.slot_count - care.covered_slot_count
                  : null
                return (
                  <tr key={c.id} className="cw-client-row">
                    <td>
                      <div className="cw-person">
                        <Avatar
                          initials={`${c.first_name[0]}${c.last_name[0]}`}
                          color={(['c1', 'c2', 'c3', 'c4'] as const)[i % 4]}
                        />
                        <div>
                          <Link
                            className="cw-client-row-link"
                            to="/dashboard/clients/$clientId"
                            params={{ clientId: c.id }}
                          >
                            {c.first_name} {c.last_name}
                          </Link>
                        </div>
                      </div>
                    </td>
                    <td>{c.date_of_birth ? differenceInYears(new Date(), parseISO(c.date_of_birth)) : '—'}</td>
                    <td>
                      {c.city}
                      <small>{c.street}</small>
                    </td>
                    <td>
                      {care ? (
                        <>
                          <span className="whitespace-nowrap">
                            <strong>{fmtHours(care.weekly_hours)} hrs</strong>
                            <span className="cw-muted"> · {care.slot_count} {care.slot_count === 1 ? 'slot' : 'slots'}</span>
                          </span>
                          {care.starts_on && (
                            <small>
                              {care.state === 'scheduled' ? 'Scheduled from' : 'Requested from'}{' '}
                              {format(parseISO(care.starts_on), 'MMM d')}
                            </small>
                          )}
                          {care.scheduled_change_on && (
                            <small>Change scheduled {format(parseISO(care.scheduled_change_on), 'MMM d')}</small>
                          )}
                          {care.revision_pending && <small>Revision pending</small>}
                        </>
                      ) : (
                        <span className="cw-muted">{care === null ? 'Not set up' : 'Unavailable'}</span>
                      )}
                    </td>
                    <td>
                      {care === undefined ? (
                        <span className="cw-muted">Unavailable</span>
                      ) : !care || care.slot_count === 0 ? (
                        <span className="cw-muted">No care slots yet</span>
                      ) : openSlots === null ? (
                        <span className="cw-muted">Imported schedule</span>
                      ) : (
                        <ClientBadge
                          tone={openSlots === 0 ? 'mint' : 'peach'}
                        >
                          {openSlots === 0
                            ? `${care.slot_count}/${care.slot_count} covered`
                            : care.covered_slot_count === 0
                              ? 'Unassigned'
                              : `${openSlots} ${openSlots === 1 ? 'slot' : 'slots'} open`}
                        </ClientBadge>
                      )}
                    </td>
                    <td>
                      <StatusDot status={c.status} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {creating && (
        <CreateClientDrawer
          onClose={() => setCreating(false)}
          onSuccess={() => void query.refetch()}
        />
      )}
    </div>
  )
}
