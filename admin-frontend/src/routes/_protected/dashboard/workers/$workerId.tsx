import { createFileRoute, Link, Outlet } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { workersApi } from '@/features/workers/api'
import { Avatar } from '@/shared/components/ui'

export const Route = createFileRoute('/_protected/dashboard/workers/$workerId')({
  component: WorkerLayout,
})

function WorkerLayout() {
  const { workerId } = Route.useParams()

  const { data: worker, isLoading, isError } = useQuery({
    queryKey: ['worker', workerId],
    queryFn: () => workersApi.getWorker(workerId),
  })

  if (isLoading) return (
    <div className="p-8 font-mono text-[11px] text-muted">Loading…</div>
  )

  if (isError || !worker) return (
    <div className="p-8 font-mono text-[11px] text-orange">Worker not found.</div>
  )

  const initials = `${worker.first_name[0] ?? ''}${worker.last_name[0] ?? ''}`.toUpperCase()
  const profile  = worker.worker_profile

  return (
    <div className="flex min-h-full bg-cream">

      {/* ── Left: Profile card ────────────────────────────────────── */}
      <div className="w-72 shrink-0 border-r border-ink flex flex-col p-8 gap-6">

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
        </div>

        <div className="border-t border-ink" />

        <div className="space-y-4">
          {worker.hire_date && (
            <div>
              <p className="font-mono text-[9px] tracking-[0.1em] uppercase text-ink-soft mb-0.5">Hired</p>
              <p className="text-[13px]">{format(new Date(worker.hire_date), 'yyyy-MM-dd')}</p>
            </div>
          )}
          {profile?.employment_type && (
            <div>
              <p className="font-mono text-[9px] tracking-[0.1em] uppercase text-ink-soft mb-0.5">Employment</p>
              <p className="text-[13px] capitalize">{profile.employment_type.replace(/_/g, ' ')}</p>
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
          {profile?.max_hours_per_week != null && (
            <div>
              <p className="font-mono text-[9px] tracking-[0.1em] uppercase text-ink-soft mb-0.5">Max hrs / wk</p>
              <p className="text-[13px]">{profile.max_hours_per_week}h</p>
            </div>
          )}
          {profile?.has_vehicle != null && (
            <div>
              <p className="font-mono text-[9px] tracking-[0.1em] uppercase text-ink-soft mb-0.5">Vehicle</p>
              <p className="text-[13px]">{profile.has_vehicle ? 'Yes' : 'No'}</p>
            </div>
          )}
        </div>

        <div className="border-t border-ink" />

        <div className="flex items-center justify-between">
          <span className={`font-mono text-[9px] tracking-[0.1em] uppercase px-2.5 py-1 border ${
            worker.is_active ? 'bg-ink text-cream border-ink' : 'border-line-soft text-muted'
          }`}>
            {worker.is_active ? 'Active' : 'Inactive'}
          </span>
          <Link
            to="/dashboard/workers/$workerId/edit"
            params={{ workerId } as never}
            className="font-mono text-[10px] tracking-[0.05em] uppercase text-ink-soft hover:text-ink"
          >
            Edit →
          </Link>
        </div>
      </div>

      {/* ── Right: Shift data ─────────────────────────────────────── */}
      <div className="flex-1 min-w-0">
        <Outlet />
      </div>
    </div>
  )
}
