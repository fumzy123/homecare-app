import { Link } from '@tanstack/react-router'
import { Kicker } from '@/shared/components/ui'
import { useExpiringCredentials } from '../hooks/useExpiringCredentials'
import { DOCUMENT_LABELS } from '../constants'

function urgencyColor(days: number) {
  if (days <= 7)  return 'text-orange'
  if (days <= 15) return 'text-amber-600'
  return 'text-ink-soft'
}

export function ComplianceAlertsPanel() {
  const { data: expiring = [] } = useExpiringCredentials()

  if (expiring.length === 0) return null

  return (
    <div>
      <Kicker leader className="mb-3.5">
        Compliance alerts — {expiring.length} expiring within 30 days
      </Kicker>
      <div className="border border-ink bg-paper">
        {expiring.map((c, i) => (
          <Link
            key={c.id}
            to="/dashboard/workers/$workerId/edit"
            params={{ workerId: c.worker_id } as never}
            className={`flex items-center justify-between px-5 py-3.5 hover:bg-line-faint transition-colors ${
              i > 0 ? 'border-t border-dashed border-line-soft' : ''
            }`}
          >
            <div>
              <p className="text-[13px] font-medium">
                {c.worker_first_name} {c.worker_last_name}
              </p>
              <p className="font-mono text-[10px] text-muted mt-0.5">
                {DOCUMENT_LABELS[c.document_type] ?? c.document_type}
              </p>
            </div>
            <div className="text-right shrink-0 ml-4">
              <p className={`font-mono text-[12px] font-medium ${urgencyColor(c.days_remaining)}`}>
                {c.days_remaining === 0 ? 'Today' : `${c.days_remaining}d`}
              </p>
              <p className="font-mono text-[9px] text-muted mt-0.5">{c.expiry_date}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
