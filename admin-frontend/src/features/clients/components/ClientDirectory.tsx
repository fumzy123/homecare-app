import { useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Plus, Search, ArrowRight } from 'lucide-react'
import { differenceInYears, parseISO } from 'date-fns'
import { Avatar, StatusDot } from '@/shared/components/ui'
import { usePlacements } from '@/features/placements/hooks/usePlacements'
import { fmtHours } from '@/features/authorizations/utils'
import { useClients } from '../hooks/useClients'
import { CreateClientDrawer } from './CreateClientDrawer'
import { ClientEmpty, ClientLoading, ClientBadge } from './ClientWorkspaceUI'
import { weeklyHours } from '../lib/care'
import '../client-workspace.css'

export function ClientDirectory() {
  const query = useClients()
  const placements = usePlacements()
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
            Clients & <em className="text-muted">care needs.</em>
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
                  'Location',
                  'Weekly care need',
                  'Coverage',
                  'Status',
                  '',
                ].map((h, i) => (
                  <th key={i}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => {
                const need = c.current_care_need
                const placement =
                  need &&
                  placements.data?.find(
                    (p) => p.weekly_care_need_id === need.id,
                  )
                return (
                  <tr key={c.id}>
                    <td>
                      <div className="cw-person">
                        <Avatar
                          initials={`${c.first_name[0]}${c.last_name[0]}`}
                          color={(['c1', 'c2', 'c3', 'c4'] as const)[i % 4]}
                        />
                        <div>
                          <Link
                            className="cw-link"
                            to="/dashboard/clients/$clientId"
                            params={{ clientId: c.id }}
                          >
                            {c.first_name} {c.last_name}
                          </Link>
                          <small>
                            {differenceInYears(
                              new Date(),
                              parseISO(c.date_of_birth),
                            )}{' '}
                            years ·{' '}
                            {c.care_arrangement === 'funded'
                              ? 'Funded'
                              : 'Self-pay'}
                          </small>
                        </div>
                      </div>
                    </td>
                    <td>
                      {c.city}
                      <small>{c.street}</small>
                    </td>
                    <td>
                      {need ? (
                        <>
                          {fmtHours(weeklyHours(need.care_slots))}h / week
                          <small>{need.care_slots.length} care slots</small>
                        </>
                      ) : (
                        <span className="cw-muted">Not active yet</span>
                      )}
                    </td>
                    <td>
                      {placements.isError ? (
                        <span className="cw-muted">Unavailable</span>
                      ) : placements.isPending ? (
                        '…'
                      ) : placement ? (
                        <ClientBadge
                          tone={
                            placement.covered_count ===
                            placement.care_slots.length
                              ? 'mint'
                              : 'peach'
                          }
                        >
                          {placement.covered_count} /{' '}
                          {placement.care_slots.length} covered
                        </ClientBadge>
                      ) : (
                        <span className="cw-muted">
                          {need?.imported ? 'Imported schedule' : '—'}
                        </span>
                      )}
                    </td>
                    <td>
                      <StatusDot status={c.status} />
                    </td>
                    <td>
                      <Link
                        aria-label={`Open ${c.first_name} ${c.last_name}`}
                        className="cw-icon"
                        to="/dashboard/clients/$clientId"
                        params={{ clientId: c.id }}
                      >
                        <ArrowRight size={16} />
                      </Link>
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
