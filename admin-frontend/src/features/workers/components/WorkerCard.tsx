import { Link } from '@tanstack/react-router'
import { type Worker } from '@/features/workers/api'
import { Avatar } from '@/shared/components/ui'

export function WorkerCard({ worker, index = 0 }: { worker: Worker; index?: number }) {
  const initials = `${worker.first_name[0] ?? ''}${worker.last_name[0] ?? ''}`.toUpperCase()
  const color = (['c1','c2','c3','c4','c5','c6'] as const)[index % 6]

  return (
    <Link
      to="/dashboard/workers/$workerId"
      params={{ workerId: worker.id }}
      className="block border border-ink bg-paper p-5 transition-all hover:-translate-x-px hover:-translate-y-px hover:shadow-[4px_4px_0_#111111]"
    >
      <div className="flex items-center gap-3 mb-4">
        <Avatar initials={initials} color={color} />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium truncate">{worker.first_name} {worker.last_name}</p>
          <p className="font-mono text-[10px] text-ink-soft truncate">{worker.email}</p>
        </div>
        <span className={`font-mono text-[9px] tracking-[0.1em] uppercase px-2 py-0.5 border shrink-0 ${
          worker.is_active ? 'bg-ink text-cream border-ink' : 'border-line-soft text-muted'
        }`}>
          {worker.is_active ? 'Active' : 'Inactive'}
        </span>
      </div>

      <div className="border-t border-dashed border-line-soft pt-3 grid grid-cols-2 gap-3">
        <div>
          <p className="font-mono text-[9px] uppercase text-muted mb-0.5">Phone</p>
          <p className="font-mono text-[11px] truncate">{worker.phone_number ?? '—'}</p>
        </div>
        <div>
          <p className="font-mono text-[9px] uppercase text-muted mb-0.5">Hire Date</p>
          <p className="font-mono text-[11px]">
            {worker.hire_date
              ? new Date(worker.hire_date).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' })
              : '—'}
          </p>
        </div>
      </div>
    </Link>
  )
}
