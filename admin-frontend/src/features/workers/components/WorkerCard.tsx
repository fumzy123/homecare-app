import { WorkerSchedulingStatus } from './WorkerSchedulingStatus'
import { Link } from '@tanstack/react-router'
import { type OrgMember, type WeekDay } from '@/features/org-members/api'
import { Avatar } from '@/shared/components/ui'

const DAYS: { key: WeekDay; label: string }[] = [
  { key: 'SU', label: 'Sun' }, { key: 'MO', label: 'Mon' },
  { key: 'TU', label: 'Tue' }, { key: 'WE', label: 'Wed' },
  { key: 'TH', label: 'Thu' }, { key: 'FR', label: 'Fri' },
  { key: 'SA', label: 'Sat' },
]

// Layer 2: controlled directory card; all data comes from the worker list.
export function WorkerCard({ worker, index = 0 }: { worker: OrgMember; index?: number }) {
  const initials = `${worker.first_name[0] ?? ''}${worker.last_name[0] ?? ''}`.toUpperCase()
  const color = (['c2', 'c3', 'c4', 'c5', 'c6'] as const)[index % 5]
  const availableDays = new Set(worker.availability.map(entry => entry.day_of_week))
  const availability = DAYS.filter(day => availableDays.has(day.key)).map(day => day.label).join(' · ')
  const rowClass = 'grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] items-start gap-4 border-t border-line-soft py-4 text-[13px]'

  return (
    <Link
      to="/dashboard/workers/$workerId"
      params={{ workerId: worker.id }}
      className="group flex min-w-0 flex-col border border-line-soft bg-cream p-6 text-ink transition-colors hover:border-ink hover:bg-paper focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink"
    >
      <Avatar initials={initials} color={color} size="lg" className="size-16! border-ink! text-[20px]! font-normal!" />
      <h2 className="mt-6 font-serif text-[32px] leading-[1.1] tracking-[-0.02em] [overflow-wrap:anywhere]">
        {worker.first_name} {worker.last_name}
      </h2>
      <p className="mt-3 text-[13px] text-ink-soft">Home support worker</p>
      <p className="mt-2 text-[12px] text-ink-soft [overflow-wrap:anywhere]">{worker.email}</p>

      <dl className="mt-8">
        <div className={rowClass}>
          <dt>Availability</dt>
          <dd className="text-right">{availability || 'Not set'}</dd>
        </div>
        <div className={rowClass}>
          <dt>Weekly hours limit</dt>
          <dd className="text-right">{worker.max_hours_per_week != null ? `${worker.max_hours_per_week} hours` : 'Not set'}</dd>
        </div>
        <div className={rowClass}>
          <dt>Employment status</dt>
          <dd className="text-right">
            <span className={`inline-block px-3 py-1 font-mono text-[11px] ${worker.is_active ? 'bg-mint-soft text-ink' : 'bg-cream-2 text-ink-soft'}`}>
              {worker.is_active ? 'Active' : 'Inactive'}
            </span>
          </dd>
        </div>
        {worker.is_active && (
          <div className={rowClass}>
            <dt>Schedule</dt>
            <dd className="text-right [&>div]:mt-0 [&>div]:font-sans [&>div]:text-[12px]">
              <WorkerSchedulingStatus worker={worker} />
            </dd>
          </div>
        )}
      </dl>
    </Link>
  )
}
