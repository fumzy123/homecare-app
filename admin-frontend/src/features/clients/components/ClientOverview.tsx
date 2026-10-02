import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { format, addDays, startOfWeek, parseISO } from 'date-fns'
import {
  ArrowRight,
  FileText,
  Phone,
  ShieldCheck,
  Users,
  MapPin,
} from 'lucide-react'
import { Avatar } from '@/shared/components/ui'
import { WEEK_STARTS_ON } from '@/shared/lib/date'
import { useCalendarShifts } from '@/features/shifts/hooks/useShifts'
import { useCareNeedVersions } from '@/features/weekly-care-need/hooks/useWeeklyCareNeed'
import { useClientAuthorizations } from '@/features/authorizations/hooks/useAuthorizations'
import { usePlacements } from '@/features/placements/hooks/usePlacements'
import { fmtHours } from '@/features/authorizations/utils'
import { useClient } from '../hooks/useClients'
import {
  authorizationForDate,
  currentCareNeed,
  weeklyHours,
  serviceName,
} from '../lib/care'
import {
  ClientPanel,
  ClientLoading,
  ClientBadge,
  ClientDialog,
} from './ClientWorkspaceUI'
import { ClientVisitDialog } from './ClientVisitDialog'
import type { ShiftOccurrence } from '@/features/shifts/api'

export function ClientOverview({ clientId }: { clientId: string }) {
  const today = format(new Date(), 'yyyy-MM-dd')
  const weekStart = startOfWeek(new Date(), { weekStartsOn: WEEK_STARTS_ON })
  const clientQuery = useClient(clientId)
  const needs = useCareNeedVersions(clientId)
  const placements = usePlacements()
  const auths = useClientAuthorizations(clientId)
  const visits = useCalendarShifts(
    today,
    format(addDays(new Date(), 14), 'yyyy-MM-dd'),
    undefined,
    clientId,
  )
  const [contact, setContact] = useState(false)
  const [selectedVisit, setSelectedVisit] = useState<ShiftOccurrence | null>(
    null,
  )
  if (!clientQuery.data) return <ClientLoading error={clientQuery.isError} />
  const c = clientQuery.data
  const current = currentCareNeed(needs.data || [], today)
  const latest = needs.data?.[0]
  const proposed =
    latest && !latest.activated_at && !latest.imported ? latest : undefined
  const coverage = placements.data?.find(
    (p) => p.weekly_care_need_id === current?.id,
  )
  const proposedPlacement = placements.data?.find(
    (p) => p.weekly_care_need_id === proposed?.id,
  )
  const covered = coverage?.care_slots.filter((s) => s.worker_id) || []
  const total = weeklyHours(current?.care_slots || [])
  const coveredHours = weeklyHours(covered)
  const open = coverage
    ? Math.max(0, coverage.care_slots.length - coverage.covered_count)
    : 0
  const upcoming = (visits.data || [])
    .filter((v) => ['scheduled', 'in_progress'].includes(v.completion_status))
    .sort((a, b) => a.start_time.localeCompare(b.start_time))
    .slice(0, 3)
  const auth = authorizationForDate(auths.data || [], today)
  const activity = [
    ...(needs.data || []).map((n) => ({
      id: n.id,
      date: n.created_at,
      title: `Weekly care need revision ${n.version} saved`,
    })),
    ...(auths.data || [])
      .filter((a) => a.created_at)
      .map((a) => ({
        id: a.id,
        date: a.created_at!,
        title: `Authorization ${a.authorization_number} recorded`,
      })),
    {
      id: 'profile',
      date: c.updated_at || c.created_at,
      title: 'Client profile updated',
    },
  ]
    .filter((a) => a.date)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 4)
  return (
    <div className="cw-columns">
      <div className="cw-stack">
        {(proposed || open > 0) && (
          <ClientPanel
            title="A little attention, better care."
            className="cw-attention"
          >
            {proposed && (
              <div className="cw-attention-item">
                <FileText size={19} />
                <div>
                  <p>A proposed care need is ready to review</p>
                  <p className="cw-muted mt-1">
                    Revision {proposed.version} · Proposed{' '}
                    {format(parseISO(proposed.effective_from), 'MMM d')}
                  </p>
                  <Link
                    className="cw-link"
                    to="/dashboard/clients/$clientId/care-need"
                    params={{ clientId }}
                    search={{ need: proposed.id }}
                  >
                    Review proposed revision <ArrowRight size={15} />
                  </Link>
                  {proposedPlacement && (
                    <p className="cw-muted mt-2">
                      {proposedPlacement.interest_count} interested workers
                    </p>
                  )}
                </div>
              </div>
            )}
            {open > 0 && (
              <div className="cw-attention-item">
                <Users size={19} />
                <div>
                  <p>{open} care slots still need coverage</p>
                  <p className="cw-muted mt-1">
                    {fmtHours(Math.max(0, total - coveredHours))} hours per week
                    open
                  </p>
                  <Link
                    className="cw-link"
                    to="/dashboard/clients/$clientId/care-need"
                    params={{ clientId }}
                    search={{ need: current?.id }}
                  >
                    Review coverage <ArrowRight size={15} />
                  </Link>
                </div>
              </div>
            )}
          </ClientPanel>
        )}
        <ClientPanel
          title="Weekly care need"
          action={
            <Link
              className="cw-link"
              to="/dashboard/clients/$clientId/care-need"
              params={{ clientId }}
            >
              Care need <ArrowRight size={15} />
            </Link>
          }
        >
          {needs.isPending ||
          needs.isError ||
          placements.isPending ||
          placements.isError ? (
            <ClientLoading
              error={needs.isError || placements.isError}
              retry={() => {
                void needs.refetch()
                void placements.refetch()
              }}
            />
          ) : (
            <div className="cw-panel-body">
              <p className="cw-label mb-5">
                Week of {format(weekStart, 'MMM d')} –{' '}
                {format(addDays(weekStart, 6), 'MMM d')}
              </p>
              {current ? (
                <>
                  <div className="cw-facts">
                    <div>
                      <div className="cw-label">Care needed</div>
                      <span className="cw-stat">{fmtHours(total)}</span> h
                    </div>
                    <div>
                      <div className="cw-label">Covered</div>
                      <span className="cw-stat">
                        {coverage ? fmtHours(coveredHours) : '—'}
                      </span>
                      {coverage && ' h'}
                    </div>
                    <div>
                      <div className="cw-label">Still open</div>
                      <span className="cw-stat text-orange">
                        {coverage
                          ? fmtHours(Math.max(0, total - coveredHours))
                          : '—'}
                      </span>
                      {coverage && ' h'}
                    </div>
                  </div>
                  {coverage ? (
                    <>
                      <div className="cw-between cw-muted mt-6">
                        <span>
                          {covered.length} of {current.care_slots.length} care
                          slots covered
                        </span>
                        <span>
                          {total ? Math.round((coveredHours / total) * 100) : 0}
                          %
                        </span>
                      </div>
                      <div
                        className="cw-coverage-bar"
                        role="meter"
                        aria-label="Weekly care coverage"
                        aria-valuenow={coveredHours}
                        aria-valuemin={0}
                        aria-valuemax={total || 1}
                      >
                        <span
                          style={{
                            width: `${total ? Math.min(100, (coveredHours / total) * 100) : 0}%`,
                          }}
                        />
                      </div>
                    </>
                  ) : (
                    <p className="cw-muted mt-5">
                      {current.imported
                        ? 'Imported schedule · individual slot coverage is not recorded.'
                        : 'Slot coverage is not available.'}
                    </p>
                  )}
                </>
              ) : (
                <p className="cw-muted">No current weekly care need.</p>
              )}
            </div>
          )}
        </ClientPanel>
        <section>
          <div className="cw-between mb-4">
            <h3>Upcoming visits</h3>
            <Link
              className="cw-link"
              to="/dashboard/clients/$clientId/visits"
              params={{ clientId }}
            >
              All visits <ArrowRight size={15} />
            </Link>
          </div>
          {visits.isPending || visits.isError ? (
            <ClientLoading
              error={visits.isError}
              retry={() => void visits.refetch()}
            />
          ) : upcoming.length ? (
            <div className="cw-upcoming">
              {upcoming.map((v) => (
                <button
                  key={`${v.shift_id}:${v.date}`}
                  className="cw-visit-card"
                  onClick={() => setSelectedVisit(v)}
                >
                  <span className="cw-label">
                    {v.date === today
                      ? 'Today'
                      : format(parseISO(v.date), 'EEE, MMM d')}
                  </span>
                  <strong>
                    {format(parseISO(v.start_time), 'HH:mm')}{' '}
                    <span className="cw-muted">
                      – {format(parseISO(v.end_time), 'HH:mm')}
                    </span>
                  </strong>
                  <p className="cw-muted">{serviceName(v.service_type)}</p>
                  <div className="cw-person mt-4">
                    <Avatar
                      initials={`${v.worker.first_name[0]}${v.worker.last_name[0]}`}
                      color="c4"
                      size="sm"
                    />
                    <span className="cw-muted">
                      {v.worker.first_name} {v.worker.last_name}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="cw-panel cw-panel-body cw-muted">
              No visits scheduled in the next two weeks.
            </div>
          )}
        </section>
        <ClientPanel
          title="Recent activity"
          action={<span className="cw-label">Client record</span>}
        >
          <div className="cw-panel-body cw-team">
            {activity.map((item) => (
              <div key={item.id}>
                <p className="text-sm">{item.title}</p>
                <p className="cw-muted mt-1">
                  {format(parseISO(item.date), 'MMM d, yyyy')}
                </p>
              </div>
            ))}
          </div>
        </ClientPanel>
      </div>
      <aside className="cw-stack">
        <ClientPanel
          title="Care team"
          action={
            <span className="cw-label">{c.care_team.length} workers</span>
          }
        >
          <div className="cw-panel-body cw-team">
            {c.care_team.length ? (
              c.care_team.map((w) => (
                <div key={w.id} className="cw-person">
                  <Avatar
                    initials={`${w.first_name[0]}${w.last_name[0]}`}
                    color="c4"
                  />
                  <div>
                    <p className="text-sm">
                      {w.first_name} {w.last_name}
                    </p>
                    <p className="cw-muted mt-1">{w.coverage.join(' · ')}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="cw-muted">No scheduled worker coverage.</p>
            )}
          </div>
        </ClientPanel>
        <ClientPanel title="Emergency contact" action={<Phone size={18} />}>
          <div className="cw-panel-body">
            <p className="cw-label">{c.emergency_contact_relationship}</p>
            <h3 className="mt-3">{c.emergency_contact_name}</h3>
            <a
              className="cw-muted block mt-2"
              href={`tel:${c.emergency_contact_phone}`}
            >
              {c.emergency_contact_phone}
            </a>
            <button className="cw-link mt-5" onClick={() => setContact(true)}>
              Contact details <ArrowRight size={15} />
            </button>
          </div>
        </ClientPanel>
        <ClientPanel
          title="Funding snapshot"
          action={<ShieldCheck size={18} />}
        >
          <div className="cw-panel-body">
            {c.care_arrangement === 'self_pay' ? (
              <p>Self-pay care</p>
            ) : auths.isPending || auths.isError ? (
              <ClientLoading error={auths.isError} />
            ) : (
              <>
                <ClientBadge tone={auth ? 'mint' : 'peach'}>
                  {auth ? 'Authorized' : 'No active authorization'}
                </ClientBadge>
                {auth && (
                  <p className="cw-muted mt-4">
                    {auth.funder}
                    <br />
                    {auth.covering_end
                      ? `Ends ${format(parseISO(auth.covering_end), 'MMM d, yyyy')}`
                      : 'No end date recorded'}
                  </p>
                )}
              </>
            )}
            <Link
              className="cw-link mt-5"
              to="/dashboard/clients/$clientId/funding"
              params={{ clientId }}
            >
              View funding <ArrowRight size={15} />
            </Link>
          </div>
        </ClientPanel>
        <ClientPanel title="Contact & home" action={<MapPin size={18} />}>
          <div className="cw-panel-body">
            <p>{c.street}</p>
            <p className="cw-muted">
              {c.city}, {c.province} {c.postal_code}
            </p>
            {c.phone_number && (
              <a href={`tel:${c.phone_number}`} className="cw-link mt-4">
                {c.phone_number}
              </a>
            )}
          </div>
        </ClientPanel>
      </aside>
      {contact && (
        <ClientDialog title="Contact details" onClose={() => setContact(false)}>
          <div className="cw-stack">
            <div>
              <h3>
                {c.first_name} {c.last_name}
              </h3>
              <p className="mt-3">{c.phone_number || 'No phone recorded'}</p>
              <p>{c.email || 'No email recorded'}</p>
              <p className="mt-3">
                {c.street}
                <br />
                {c.city}, {c.province} {c.postal_code}
              </p>
            </div>
            <div>
              <p className="cw-label">
                Emergency contact · {c.emergency_contact_relationship}
              </p>
              <h3 className="mt-2">{c.emergency_contact_name}</h3>
              <a
                href={`tel:${c.emergency_contact_phone}`}
                className="cw-link mt-3"
              >
                {c.emergency_contact_phone}
              </a>
            </div>
          </div>
        </ClientDialog>
      )}
      {selectedVisit && (
        <ClientVisitDialog
          visit={selectedVisit}
          onClose={() => setSelectedVisit(null)}
        />
      )}
    </div>
  )
}
