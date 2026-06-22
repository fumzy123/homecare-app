import { useState } from 'react'
import { format } from 'date-fns'
import { Tag } from '@/shared/components/ui'
import type { Authorization } from '../api'
import { SERVICE_TYPE_LABELS } from '../constants'
import { totalAuthorizedHours, periodNoun, fmtHours, endsRelLabel, daysUntil } from '../utils'

/**
 * The active authorization, pinned at the top of the tab as the heaviest
 * element. Left column = the funder document (who/when); right column = the
 * authorized-hours breakdown (per service + total). This card states only what
 * the funder authorized — the plan-vs-authorization check lives in the care plan.
 */
export function ActiveAuthHero({
  auth,
  onAmend,
  onCancel,
  cancelling,
}: {
  auth: Authorization
  onAmend: (a: Authorization) => void
  onCancel: (id: string) => void
  cancelling: boolean
}) {
  const [confirmCancel, setConfirmCancel] = useState(false)
  const total = totalAuthorizedHours(auth)

  // Expiry nudge — only when the funder's window has a near-term end date.
  const daysToExpiry = auth.covering_end ? daysUntil(auth.covering_end) : null
  const expiringSoon = daysToExpiry !== null && daysToExpiry >= 0 && daysToExpiry <= 15
  const expiryLabel = daysToExpiry === 0 ? 'Expires today' : `Expires in ${daysToExpiry} day${daysToExpiry === 1 ? '' : 's'}`

  return (
    <div className="border border-ink bg-paper">
      {/* header bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-ink bg-cream-2">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[9px] tracking-[0.14em] uppercase text-ink-soft">Active authorization</span>
          <Tag variant="mint">● Active</Tag>
          {expiringSoon && (
            <span className={`inline-flex items-center gap-1.5 font-mono text-[9px] tracking-[0.06em] uppercase px-2 py-0.5 border ${
              daysToExpiry! <= 7 ? 'border-orange bg-orange-soft text-orange' : 'border-amber-600 text-amber-600'
            }`}>
              <span className="dot" style={{ background: daysToExpiry! <= 7 ? 'var(--color-orange)' : '#d97706' }} />
              {expiryLabel}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2.5">
          <button onClick={() => onAmend(auth)}
            className="font-mono text-[10px] tracking-[0.06em] uppercase border border-ink bg-paper px-3 py-1.5 hover:bg-ink hover:text-cream transition-colors">
            Amend →
          </button>
          {confirmCancel ? (
            <span className="flex items-center gap-2">
              <button onClick={() => onCancel(auth.id)} disabled={cancelling}
                className="font-mono text-[10px] tracking-[0.06em] uppercase border border-orange text-orange px-3 py-1.5 hover:bg-orange hover:text-white transition-colors disabled:opacity-40">
                {cancelling ? '…' : 'Confirm cancel'}
              </button>
              <button onClick={() => setConfirmCancel(false)}
                className="font-mono text-[10px] tracking-[0.06em] uppercase text-ink-soft hover:text-ink">Keep</button>
            </span>
          ) : (
            <button onClick={() => setConfirmCancel(true)}
              className="font-mono text-[10px] tracking-[0.06em] uppercase border border-line-soft text-ink-soft px-3 py-1.5 hover:border-orange hover:text-orange transition-colors">
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* body */}
      <div className="grid grid-cols-[1.2fr_1fr]">
        {/* left: funder document */}
        <div className="px-6 py-5 border-r border-line-soft">
          <p className="font-serif text-[26px] leading-none">{auth.funder}</p>

          <div className="flex gap-7 mt-3.5">
            <div>
              <p className="font-mono text-[9px] tracking-[0.1em] uppercase text-ink-soft">Authorization #</p>
              <p className="font-mono text-[12.5px] mt-1">{auth.authorization_number}</p>
            </div>
            {auth.funder_file_number && (
              <div>
                <p className="font-mono text-[9px] tracking-[0.1em] uppercase text-ink-soft">File #</p>
                <p className="font-mono text-[12.5px] mt-1">{auth.funder_file_number}</p>
              </div>
            )}
          </div>

          <div className="mt-4">
            <p className="font-mono text-[9px] tracking-[0.1em] uppercase text-ink-soft">Covering period</p>
            <p className="font-mono text-[12.5px] mt-1">
              {format(new Date(auth.covering_start), 'MMM d, yyyy')} → {auth.covering_end ? format(new Date(auth.covering_end), 'MMM d, yyyy') : 'open-ended'}
            </p>
            <p className="font-mono text-[9px] tracking-[0.04em] uppercase text-mint-dark mt-1">{endsRelLabel(auth)}</p>
          </div>
          {auth.notes && <p className="text-[12px] text-ink-soft italic mt-4">{auth.notes}</p>}
        </div>

        {/* right: authorized hours breakdown */}
        <div className="px-6 py-5">
          <p className="font-mono text-[9px] tracking-[0.1em] uppercase text-ink-soft mb-3">Authorized hours</p>
          <div className="flex flex-col gap-2.5">
            {auth.services.map((s) => (
              <div key={s.id} className="flex items-baseline justify-between">
                <span className="text-[13px]">{SERVICE_TYPE_LABELS[s.service_type]}</span>
                <span className="font-mono text-[11px] text-ink-soft">
                  <strong className="text-ink">{fmtHours(s.authorized_hours)}h</strong> / {periodNoun(auth.hours_period)}
                </span>
              </div>
            ))}
          </div>
          <div className="border-t border-dashed border-line-soft my-3" />
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-[9px] tracking-[0.1em] uppercase text-ink-soft">Authorized total</span>
            <span className="font-serif text-[18px]">
              {fmtHours(total)}h <span className="font-mono text-[10px] text-muted">/ {periodNoun(auth.hours_period)}</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
