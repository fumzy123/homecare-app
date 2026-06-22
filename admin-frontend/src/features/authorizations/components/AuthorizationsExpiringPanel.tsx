import { Link } from '@tanstack/react-router'
import { Card, Kicker } from '@/shared/components/ui'
import { useExpiringAuthorizations } from '../hooks/useAuthorizations'

function urgencyColor(days: number) {
  if (days <= 7)  return 'text-orange'
  if (days <= 15) return 'text-amber-600'
  return 'text-ink-soft'
}

/**
 * Dashboard feed of active authorizations nearing the end of their covering
 * window (within 15 days). Mirrors ComplianceAlertsPanel — a pull/read-model,
 * recomputed every load, so it can never go stale. Hidden when nothing is due.
 */
export function AuthorizationsExpiringPanel() {
  const { data: expiring = [] } = useExpiringAuthorizations()

  if (expiring.length === 0) {
    return (
      <Card className="p-6 h-full">
        <Kicker className="mb-2">D / Authorizations</Kicker>
        <div className="font-serif text-[22px] leading-none mt-2 mb-1">All authorizations valid</div>
        <p className="font-mono text-[10px] text-muted tracking-wide">NO ACTION NEEDED</p>
      </Card>
    )
  }

  return (
    <Card className="p-0">
      <div className="px-6 py-5 border-b border-ink">
        <Kicker className="mb-1">D / Authorizations</Kicker>
        <h3 className="font-serif text-[22px] leading-none mt-2">
          Expiring soon <span className="italic text-muted">— {expiring.length} within 15 days</span>
        </h3>
      </div>
      <div>
        {expiring.map((a, i) => (
          <Link
            key={a.authorization_id}
            to="/dashboard/clients/$clientId/care-plan"
            params={{ clientId: a.client_id } as never}
            className={`flex items-center justify-between px-5 py-3.5 hover:bg-line-faint transition-colors ${
              i > 0 ? 'border-t border-dashed border-line-soft' : ''
            }`}
          >
            <div>
              <p className="text-[13px] font-medium">
                {a.client_first_name} {a.client_last_name}
              </p>
              <p className="font-mono text-[10px] text-muted mt-0.5">
                {a.funder} · {a.authorization_number}
              </p>
            </div>
            <div className="text-right shrink-0 ml-4">
              <p className={`font-mono text-[12px] font-medium ${urgencyColor(a.days_remaining)}`}>
                {a.days_remaining === 0 ? 'Today' : `${a.days_remaining}d`}
              </p>
              <p className="font-mono text-[9px] text-muted mt-0.5">{a.covering_end}</p>
            </div>
          </Link>
        ))}
      </div>
    </Card>
  )
}
