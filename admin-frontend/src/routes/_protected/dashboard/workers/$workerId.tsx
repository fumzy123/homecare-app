import { createFileRoute, Link, Outlet, useRouterState } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { orgMembersApi } from '@/features/org-members/api'
import { Avatar } from '@/shared/components/ui'

export const Route = createFileRoute('/_protected/dashboard/workers/$workerId')({
  component: WorkerLayout,
})

const TABS = [
  { label: 'Shifts',     to: '/dashboard/workers/$workerId' },
  { label: 'Attendance', to: '/dashboard/workers/$workerId/attendance' },
  { label: 'Leave',      to: '/dashboard/workers/$workerId/leave' },
  { label: 'Documents',  to: '/dashboard/workers/$workerId/documents' },
] as const

function WorkerTabNav({ workerId }: { workerId: string }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  return (
    <div className="flex border-b border-ink bg-cream px-8">
      {TABS.map(({ label, to }) => {
        const href = to.replace('$workerId', workerId)
        const active = pathname === href || (label === 'Shifts' && pathname === href.replace(/\/$/, ''))
        return (
          <Link
            key={label}
            to={to}
            params={{ workerId } as never}
            className={`px-4 py-3 font-mono text-[10px] tracking-[0.08em] uppercase border-b-2 transition-colors ${
              active
                ? 'border-ink text-ink'
                : 'border-transparent text-ink-soft hover:text-ink'
            }`}
          >
            {label}
          </Link>
        )
      })}
    </div>
  )
}

function WorkerLayout() {
  const { workerId } = Route.useParams()

  const { data: worker, isLoading, isError } = useQuery({
    queryKey: ['worker', workerId],
    queryFn: () => orgMembersApi.getOrgMember(workerId),
  })

  if (isLoading) return (
    <div className="p-8 font-mono text-[11px] text-muted">Loading…</div>
  )

  if (isError || !worker) return (
    <div className="p-8 font-mono text-[11px] text-orange">Worker not found.</div>
  )

  const initials = `${worker.first_name[0] ?? ''}${worker.last_name[0] ?? ''}`.toUpperCase()

  return (
    <div className="flex min-h-full bg-cream">

      {/* ── Left: Profile card ────────────────────────────────────── */}
      <div className="w-72 shrink-0 border-r border-ink flex flex-col p-8 gap-6 sticky top-0 overflow-hidden" style={{ height: '100vh' }}>

        <Link
          to="/dashboard/workers"
          className="font-mono text-[10px] tracking-[0.08em] uppercase text-ink-soft hover:text-ink"
        >
          ← Workers
        </Link>

        <div>
          <Avatar initials={initials} color="c1" size="xl" className="mb-5" />
          <h1 className="font-serif text-[34px] leading-[1.0] font-medium tracking-[-0.02em]">
            {worker.first_name}<br />
            <em>{worker.last_name}</em>
          </h1>
          <p className="font-mono text-[10px] tracking-[0.12em] uppercase text-ink-soft mt-2">
            {worker.role.replace(/_/g, ' ')}
          </p>
          <span className={`mt-3 inline-block font-mono text-[9px] tracking-[0.1em] uppercase px-2.5 py-1 border ${
            worker.is_active ? 'bg-ink text-cream border-ink' : 'border-line-soft text-muted'
          }`}>
            {worker.is_active ? 'Active' : 'Inactive'}
          </span>
        </div>

        <div className="border-t border-ink" />

        <div className="space-y-4">
          {worker.hire_date && (
            <div>
              <p className="font-mono text-[9px] tracking-[0.1em] uppercase text-ink-soft mb-0.5">Hired</p>
              <p className="text-[13px]">{format(new Date(worker.hire_date), 'yyyy-MM-dd')}</p>
            </div>
          )}
          {worker.employment_type && (
            <div>
              <p className="font-mono text-[9px] tracking-[0.1em] uppercase text-ink-soft mb-0.5">Employment</p>
              <p className="text-[13px] capitalize">{worker.employment_type!.replace(/_/g, ' ')}</p>
            </div>
          )}
          {worker.phone_number && (
            <div>
              <p className="font-mono text-[9px] tracking-[0.1em] uppercase text-ink-soft mb-0.5">Phone</p>
              <p className="text-[13px]">{worker.phone_number}</p>
            </div>
          )}
          <div>
            <p className="font-mono text-[9px] tracking-[0.1em] uppercase text-ink-soft mb-0.5">Email</p>
            <p className="text-[12px] break-all">{worker.email}</p>
          </div>
          {worker.max_hours_per_week != null && (
            <div>
              <p className="font-mono text-[9px] tracking-[0.1em] uppercase text-ink-soft mb-0.5">Max hrs / wk</p>
              <p className="text-[13px]">{worker.max_hours_per_week}h</p>
            </div>
          )}
          {worker.has_vehicle != null && (
            <div>
              <p className="font-mono text-[9px] tracking-[0.1em] uppercase text-ink-soft mb-0.5">Vehicle</p>
              <p className="text-[13px]">{worker.has_vehicle ? 'Yes' : 'No'}</p>
            </div>
          )}
        </div>

        <div className="border-t border-ink" />

        <Link
          to="/dashboard/workers/$workerId/edit"
          params={{ workerId } as never}
          className="font-mono text-[10px] tracking-[0.05em] uppercase text-ink-soft hover:text-ink"
        >
          Edit →
        </Link>
      </div>

      {/* ── Right: Tab nav + content ──────────────────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col">
        <WorkerTabNav workerId={workerId} />
        <Outlet />
      </div>
    </div>
  )
}
