import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowRight, Plus, Search } from 'lucide-react'
import { usePlacements } from '../hooks/usePlacements'
import { useClients } from '@/features/clients/hooks/useClients'
import { PostPlacementDrawer } from './PostPlacementDrawer'
import { RequestCoverage, RequestStatus } from './CareRequestUI'
import { requestDate, sortRequests } from '../lib/careRequests'
import { useAgencyDate } from '../hooks/useAgencyDate'
import type { PlacementStatus } from '../api'

// Layer 3: directory queries and local filters; routes only compose this page.
export function CareRequestDirectory() {
  const [tab, setTab] = useState<'all' | PlacementStatus>('open')
  const [search, setSearch] = useState('')
  const [posting, setPosting] = useState(false)
  const requests = usePlacements()
  const clients = useClients()
  const today = useAgencyDate()
  const rows = sortRequests(requests.data ?? []).filter(
    (p) =>
      (tab === 'all' || p.status === tab) &&
      `${p.client_first_name} ${p.client_last_name}`
        .toLowerCase()
        .includes(search.toLowerCase().trim()),
  )
  return (
    <div className="care-requests cr-page">
      <header className="cr-header cr-between">
        <div>
          <p className="cr-label">06 / Care requests</p>
          <h1>
            Clients needing <em>care.</em>
          </h1>
        </div>
        <button className="cr-button" onClick={() => setPosting(true)}>
          <Plus size={16} /> Post care request
        </button>
      </header>
      <div className="cr-toolbar">
        <div className="cr-tabs" aria-label="Filter care requests">
          {(
            [
              ['open', 'Open'],
              ['filled', 'Fully covered'],
              ['closed', 'Closed'],
              ['all', 'All'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              aria-pressed={tab === key}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="cr-search">
          <Search size={16} aria-hidden="true" />
          <input
            aria-label="Search care requests"
            placeholder="Search clients…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
      </div>
      {requests.isPending ? (
        <p role="status" className="cr-empty">
          Loading care requests…
        </p>
      ) : requests.isError ? (
        <div role="alert" className="cr-empty">
          Could not load care requests.{' '}
          <button className="cr-link" onClick={() => void requests.refetch()}>
            Try again
          </button>
        </div>
      ) : rows.length ? (
        <table
          className="cr-table"
          aria-label="Care requests sorted by start date"
        >
          <thead>
            <tr>
              <th scope="col">Client</th>
              <th scope="col">Care request start date</th>
              <th scope="col">Coverage</th>
              <th scope="col">Interested</th>
              <th scope="col">
                <span className="sr-only">Action</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="cr-request-row">
                <td>
                  <span className="cr-client-name">
                    {p.client_first_name} {p.client_last_name}
                  </span>
                  {tab === 'all' && (
                    <div className="mt-2">
                      <RequestStatus request={p} />
                    </div>
                  )}
                </td>
                <td data-label="Care request start date">
                  <span
                    className={
                      p.status === 'open' &&
                      p.start_date &&
                      p.start_date <= today
                        ? 'cr-overdue'
                        : ''
                    }
                  >
                    {requestDate(p.start_date)}
                  </span>
                </td>
                <td data-label="Coverage">
                  <RequestCoverage request={p} />
                </td>
                <td data-label="Interested">
                  <span className="cr-number">{p.interest_count}</span>
                </td>
                <td>
                  <Link
                    className="cr-link cr-request-link"
                    to="/dashboard/placements/$placementId"
                    params={{ placementId: p.id }}
                    aria-label={`View ${p.client_first_name} ${p.client_last_name}`}
                  >
                    View <ArrowRight size={17} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="cr-empty">
          <h2>{search ? 'No matching requests.' : 'No care requests here.'}</h2>
          <p className="cr-muted">
            {search
              ? 'Try another client name.'
              : 'Posted care requests will appear here.'}
          </p>
        </div>
      )}
      {posting &&
        (clients.isPending ? (
          <p role="status">Loading clients…</p>
        ) : clients.isError ? (
          <div role="alert">
            Could not load clients.{' '}
            <button className="cr-link" onClick={() => void clients.refetch()}>
              Retry
            </button>{' '}
            <button className="cr-link" onClick={() => setPosting(false)}>
              Cancel
            </button>
          </div>
        ) : (
          <PostPlacementDrawer
            clients={clients.data ?? []}
            onClose={() => setPosting(false)}
          />
        ))}
    </div>
  )
}
