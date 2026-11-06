import { CareTerminology } from '@/shared/components/CareTerminology'
import { useState } from 'react'
import { Link, Outlet, useMatches } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import {
  ChevronRight,
  MapPin,
  Phone,
  Plus,
  UserRound,
  ArrowUpRight,
} from 'lucide-react'
import { CreateShiftDrawer } from '@/features/shifts/components/CreateShiftDrawer'
import { useWorker } from '../hooks/useWorkers'
import { useWorkerClock } from '../hooks/useWorkerProfile'
import { useWorkerCredentials } from '../hooks/useWorkerCredentials'
import { WorkerProfileContext } from '../hooks/WorkerProfileContext'
import { credentialStatus, dateLabel } from '../lib/profile'
import { WorkerDialog, WorkerLoading } from './WorkerProfileUI'
import type { OrgMember } from '@/features/org-members/api'
import '../worker-workspace.css'

const tabs = [
  ['Overview', '/dashboard/workers/$workerId'],
  ['Schedule', '/dashboard/workers/$workerId/schedule'],
  ['Assignments', '/dashboard/workers/$workerId/assignments'],
  ['Documents', '/dashboard/workers/$workerId/documents'],
  ['Attendance & leave', '/dashboard/workers/$workerId/attendance'],
] as const

function ProfileDetails({
  worker,
  kind,
  onClose,
}: {
  worker: OrgMember
  kind: 'contact' | 'profile'
  onClose: () => void
}) {
  const contact = kind === 'contact'
  const values = contact
    ? [
        [
          'Phone',
          worker.phone_number ? (
            <a href={`tel:${worker.phone_number}`}>{worker.phone_number}</a>
          ) : (
            'Not recorded'
          ),
        ],
        ['Email', <a href={`mailto:${worker.email}`}>{worker.email}</a>],
        ['Emergency contact', worker.emergency_contact_name || 'Not recorded'],
        [
          'Relationship',
          worker.emergency_contact_relationship || 'Not recorded',
        ],
        [
          'Emergency phone',
          worker.emergency_contact_phone ? (
            <a href={`tel:${worker.emergency_contact_phone}`}>
              {worker.emergency_contact_phone}
            </a>
          ) : (
            'Not recorded'
          ),
        ],
      ]
    : [
        ['Employment status', worker.employment_status.replaceAll('_', ' ')],
        [
          'Employment type',
          worker.employment_type?.replaceAll('_', '-') || 'Not recorded',
        ],
        [
          'Hire date',
          worker.hire_date ? dateLabel(worker.hire_date) : 'Not recorded',
        ],
        [
          'Weekly limit',
          worker.max_hours_per_week == null
            ? 'Not set'
            : `${worker.max_hours_per_week} hours`,
        ],
        [
          'Vehicle',
          worker.has_vehicle == null
            ? 'Not recorded'
            : worker.has_vehicle
              ? 'Yes'
              : 'No',
        ],
        [
          'Address',
          [worker.street, worker.city, worker.province, worker.postal_code]
            .filter(Boolean)
            .join(', ') || 'Not recorded',
        ],
        [
          'Date of birth',
          worker.date_of_birth
            ? dateLabel(worker.date_of_birth)
            : 'Not recorded',
        ],
        ['Gender', worker.gender || 'Not recorded'],
      ]
  return (
    <WorkerDialog
      title={contact ? `Contact ${worker.first_name}` : 'Profile & employment'}
      subtitle={`${worker.first_name} ${worker.last_name}`}
      onClose={onClose}
    >
      <dl className="wp-details">
        {values.map(([label, value]) => (
          <div key={String(label)}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <div className="wp-actions">
        <button className="wp-btn" onClick={onClose}>
          Close
        </button>
        <Link
          className="wp-btn wp-primary"
          to="/dashboard/workers/$workerId/edit"
          params={{ workerId: worker.id }}
          onClick={onClose}
        >
          Edit profile <ArrowUpRight size={15} />
        </Link>
      </div>
    </WorkerDialog>
  )
}

export function WorkerWorkspace({ workerId }: { workerId: string }) {
  const query = useWorker(workerId),
    clock = useWorkerClock(),
    credentials = useWorkerCredentials(workerId)
  const qc = useQueryClient()
  const pathname = useMatches({
    select: (matches) => matches.at(-1)?.pathname.replace(/\/$/, '') || '',
  })
  const [details, setDetails] = useState<'contact' | 'profile' | null>(null)
  const [creating, setCreating] = useState(false)
  if (pathname.endsWith('/edit'))
    return (
      <div className="worker-workspace wp-page">
        <Outlet />
      </div>
    )
  if (
    query.isPending ||
    !query.data ||
    clock.query.isPending ||
    !clock.query.data
  )
    return (
      <div className="worker-workspace wp-page">
        <WorkerLoading
          error={query.isError || clock.query.isError}
          retry={() => {
            void query.refetch()
            void clock.query.refetch()
          }}
        />
      </div>
    )
  if (!clock.timezone)
    return (
      <div className="worker-workspace wp-page">
        <p className="wp-empty">
          Set the agency timezone to view this worker’s schedule.{' '}
          <Link className="wp-link" to="/settings/agency">
            Agency settings
          </Link>
        </p>
      </div>
    )
  const worker = query.data
  const attentionCount =
    credentials.data?.filter((c) =>
      ['review', 'expired', 'expiring'].includes(
        credentialStatus(c, clock.today),
      ),
    ).length || 0
  return (
    <CareTerminology value="shift"><WorkerProfileContext
      value={{
        worker,
        today: clock.today,
        now: clock.now,
        timezone: clock.timezone,
      }}
    >
      <div className="worker-workspace wp-page">
        {(query.isError || clock.query.isError) && (
          <WorkerLoading
            error
            refresh
            retry={() => {
              void query.refetch()
              void clock.query.refetch()
            }}
          />
        )}
        <nav className="wp-breadcrumb" aria-label="Breadcrumb">
          <Link to="/dashboard/workers">Workers</Link>
          <ChevronRight size={13} />
          <span>Worker profile</span>
        </nav>
        <header className="wp-masthead">
          <div className="wp-identity">
            <div className="wp-avatar" aria-hidden="true">
              {worker.first_name[0]}
              {worker.last_name[0]}
            </div>
            <div>
              <h1>
                {worker.first_name} <em>{worker.last_name}</em>
              </h1>
              <div className="wp-subtitle">
                <span
                  className={`wp-dot${!worker.is_active ? ' wp-dot-muted' : ''}`}
                />
                <span>{worker.is_active ? 'Active' : 'Inactive'}</span>
                <span>·</span>
                <span>Home support worker</span>
                {worker.employment_type && (
                  <>
                    <span>·</span>
                    <span>{worker.employment_type.replaceAll('_', '-')}</span>
                  </>
                )}
                {worker.is_active && worker.on_standby && (
                  <span className="wp-badge">On standby</span>
                )}
              </div>
            </div>
          </div>
          <button
            className="wp-btn wp-primary"
            disabled={!worker.is_active}
            onClick={() => setCreating(true)}
          >
            <Plus size={16} />
            Schedule shift
          </button>
        </header>
        <div className="wp-contactline">
          {worker.city && (
            <span className="wp-row wp-muted">
              <MapPin size={15} />
              {[worker.city, worker.province].filter(Boolean).join(', ')}
            </span>
          )}
          <button onClick={() => setDetails('contact')}>
            <Phone size={15} />
            Contact {worker.first_name}
          </button>
          <button onClick={() => setDetails('profile')}>
            <UserRound size={15} />
            Profile & employment <ArrowUpRight size={14} />
          </button>
        </div>
        <nav className="wp-tabs" aria-label="Worker pages">
          {tabs.map(([label, to]) => (
            <Link
              key={to}
              to={to}
              params={{ workerId }}
              activeOptions={{ exact: true }}
              aria-current={
                pathname === to.replace('$workerId', workerId)
                  ? 'page'
                  : undefined
              }
            >
              {label}
              {label === 'Documents' &&
                attentionCount > 0 &&
                !credentials.isError && (
                  <span
                    className="wp-count"
                    aria-label={`${attentionCount} documents need attention`}
                  >
                    {attentionCount}
                  </span>
                )}
            </Link>
          ))}
        </nav>
        <Outlet />
        <footer className="wp-footer">Times shown in {clock.timezone}</footer>
        {details && (
          <ProfileDetails
            worker={worker}
            kind={details}
            onClose={() => setDetails(null)}
          />
        )}
        {creating && (
          <CreateShiftDrawer
            preselectedWorkerId={workerId}
            onClose={() => setCreating(false)}
            onSuccess={() => {
              setCreating(false)
              void qc.invalidateQueries({ queryKey: ['shifts'] })
              void qc.invalidateQueries({ queryKey: ['worker', workerId] })
              void qc.invalidateQueries({ queryKey: ['workers'] })
            }}
          />
        )}
      </div>
    </WorkerProfileContext></CareTerminology>
  )
}
