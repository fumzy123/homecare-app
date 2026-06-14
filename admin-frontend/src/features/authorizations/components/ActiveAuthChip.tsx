import { Link } from '@tanstack/react-router'
import { format } from 'date-fns'
import type { Authorization } from '../api'
import { HOURS_PERIOD_LABELS } from '../constants'
import { activeAuthorization, totalAuthorizedHours, endsRelLabel } from '../utils'

/**
 * Persistent funding context in the client rail. Shows the single active
 * authorization as a compact "purchase order" chip; when there is none, prompts
 * the admin to add one. Visible on every client tab.
 */
export function ActiveAuthChip({ clientId, authorizations }: { clientId: string; authorizations: Authorization[] }) {
  const auth = activeAuthorization(authorizations)

  if (!auth) {
    return (
      <Link
        to="/dashboard/clients/$clientId/authorization"
        params={{ clientId } as never}
        className="block border border-dashed border-line-soft bg-paper px-3 py-3 hover:border-ink transition-colors"
      >
        <p className="font-mono text-[9px] tracking-[0.1em] uppercase text-orange flex items-center gap-1.5">
          <span className="dot dot-orange" /> No authorization
        </p>
        <p className="font-mono text-[10px] text-ink-soft mt-1">＋ Add authorization →</p>
      </Link>
    )
  }

  const total = totalAuthorizedHours(auth)
  const expiring = auth.covering_end != null && (() => {
    const d = new Date(auth.covering_end)
    const days = Math.round((d.getTime() - Date.now()) / 86_400_000)
    return days >= 0 && days <= 30
  })()

  return (
    <Link
      to="/dashboard/clients/$clientId/authorization"
      params={{ clientId } as never}
      className="block border border-ink bg-paper px-3 py-3 hover:bg-cream-2 transition-colors"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-[9px] tracking-[0.1em] uppercase text-ink-soft flex items-center gap-1.5">
          <span className="dot dot-mint" /> Active authorization
        </span>
        <span className="font-mono text-[9px] text-muted">{auth.authorization_number}</span>
      </div>
      <p className="text-[13px] font-medium leading-tight">{auth.funder}</p>
      <p className="font-mono text-[10px] text-ink-soft mt-1">
        {total}h / {HOURS_PERIOD_LABELS[auth.hours_period].toLowerCase()} · {auth.services.length} service{auth.services.length === 1 ? '' : 's'}
      </p>
      <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-dashed border-line-soft">
        <span className="font-mono text-[9.5px] text-ink-soft">
          {auth.covering_end ? `thru ${format(new Date(auth.covering_end), 'MMM d, yyyy')}` : 'open-ended'}
        </span>
        <span className={`font-mono text-[9px] tracking-[0.04em] uppercase ${expiring ? 'text-orange' : 'text-mint-dark'}`}>
          {endsRelLabel(auth)}
        </span>
      </div>
    </Link>
  )
}
