import { ProgressBar } from '@/shared/components/ui'
import { useAuthorizationCompliance } from '../hooks/useAuthorizations'
import type { ServiceCompliance } from '../api'
import { SERVICE_TYPE_LABELS } from '../constants'

const labelClass = 'font-mono text-[9px] tracking-[0.1em] uppercase text-ink-soft'

function fmtHours(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

function ComplianceRow({ s }: { s: ServiceCompliance }) {
  const exceeded = s.status === 'exceeded'
  const variant  = exceeded || s.status === 'approaching' ? 'orange' : 'mint'
  const pct      = s.authorized_biweekly > 0 ? (s.planned_biweekly / s.authorized_biweekly) * 100 : 0
  const noAuth   = s.authorized_biweekly === 0

  return (
    <div className="px-4 py-3">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className={`text-[13px] ${exceeded ? 'font-medium' : ''}`}>{SERVICE_TYPE_LABELS[s.service_type]}</span>
        <span className={`font-mono text-[11px] ${exceeded ? 'text-orange font-bold' : 'text-ink-soft'}`}>
          {fmtHours(s.planned_biweekly)} / {noAuth ? '—' : fmtHours(s.authorized_biweekly)}h
          <span className="text-[9px] tracking-[0.08em] uppercase ml-1.5">bi-weekly</span>
        </span>
      </div>
      <ProgressBar value={pct} variant={variant} />
      {exceeded && (
        <p className="mt-1 font-mono text-[10px] text-orange">
          {noAuth
            ? 'No hours authorized for this service'
            : `Exceeds authorization by ${fmtHours(s.planned_biweekly - s.authorized_biweekly)}h`}
        </p>
      )}
    </div>
  )
}

export function ComplianceSummary({ clientId }: { clientId: string }) {
  const { data: compliance } = useAuthorizationCompliance(clientId)

  // Nothing authorized and nothing planned — no compliance story to tell yet.
  if (!compliance || compliance.services.length === 0) return null

  const anyPlanned = compliance.services.some((s) => s.planned_biweekly > 0)

  return (
    <div className="border border-ink bg-paper">
      <div className="px-4 py-3 border-b border-ink">
        <p className={labelClass}>Planned vs Authorized</p>
      </div>
      {anyPlanned ? (
        <div className="divide-y divide-dashed divide-line-soft">
          {compliance.services.map((s) => <ComplianceRow key={s.service_type} s={s} />)}
        </div>
      ) : (
        <p className="px-4 py-5 font-mono text-[10px] text-muted tracking-wide">
          NO CARE PLANNED YET — ADD BLOCKS IN THE CARE SCHEDULE ABOVE TO CHECK THEM AGAINST THE AUTHORIZED HOURS
        </p>
      )}
    </div>
  )
}
