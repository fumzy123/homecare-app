import { useState } from 'react'
import { format } from 'date-fns'
import { Tag } from '@/shared/components/ui'
import type { Authorization, AuthorizationCompliance } from '../api'
import { HOURS_PERIOD_LABELS, SERVICE_TYPE_LABELS } from '../constants'
import { totalAuthorizedHours, periodNoun, fmtHours } from '../utils'

/**
 * The active authorization, pinned at the top of the tab as the heaviest
 * element. Left column = the funder document; right column = live planned-vs-
 * authorized bars per service (over the bi-weekly window).
 */
export function ActiveAuthHero({
  auth,
  compliance,
  onAmend,
  onCancel,
  cancelling,
}: {
  auth: Authorization
  compliance?: AuthorizationCompliance
  onAmend: (a: Authorization) => void
  onCancel: (id: string) => void
  cancelling: boolean
}) {
  const [confirmCancel, setConfirmCancel] = useState(false)
  const total = totalAuthorizedHours(auth)

  const byService = new Map((compliance?.services ?? []).map((c) => [c.service_type, c]))
  const allCompliant = (compliance?.services ?? []).every((c) => c.status !== 'exceeded')

  return (
    <div className="border border-ink bg-paper">
      {/* header bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-ink bg-cream-2">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[9px] tracking-[0.14em] uppercase text-ink-soft">Active authorization</span>
          <Tag variant="mint">● Active</Tag>
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
          <div className="flex items-baseline justify-between">
            <p className="font-serif text-[26px] leading-none">{auth.funder}</p>
            <span className="font-mono text-[11px] text-ink-soft">{auth.authorization_number}</span>
          </div>
          <p className="font-mono text-[11px] text-muted mt-1.5">
            {auth.funder_file_number ? `File #${auth.funder_file_number} · ` : ''}{HOURS_PERIOD_LABELS[auth.hours_period]}
          </p>
          <div className="flex gap-7 mt-4">
            <div>
              <p className="font-mono text-[9px] tracking-[0.1em] uppercase text-ink-soft">Covering period</p>
              <p className="font-mono text-[12.5px] mt-1">
                {format(new Date(auth.covering_start), 'MMM d, yyyy')} → {auth.covering_end ? format(new Date(auth.covering_end), 'MMM d, yyyy') : 'open-ended'}
              </p>
            </div>
            <div>
              <p className="font-mono text-[9px] tracking-[0.1em] uppercase text-ink-soft">Authorized total</p>
              <p className="font-serif text-[18px] mt-0.5">
                {fmtHours(total)}h <span className="font-mono text-[10px] text-muted">/ {periodNoun(auth.hours_period)}</span>
              </p>
            </div>
          </div>
          {auth.notes && <p className="text-[12px] text-ink-soft italic mt-4">{auth.notes}</p>}
        </div>

        {/* right: live per-service utilization */}
        <div className="px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <p className="font-mono text-[9px] tracking-[0.1em] uppercase text-ink-soft">Planned vs authorized</p>
            <span className={`font-mono text-[9px] tracking-[0.04em] uppercase ${allCompliant ? 'text-mint-dark' : 'text-orange'}`}>
              ● {allCompliant ? 'Compliant' : 'Over cap'}
            </span>
          </div>
          <div className="flex flex-col gap-3">
            {auth.services.map((s) => {
              const c = byService.get(s.service_type)
              const authBi = c?.authorized_biweekly ?? s.authorized_hours
              const planned = c?.planned_biweekly ?? 0
              const over = planned > authBi + 1e-9
              const pct = authBi > 0 ? Math.min(100, (planned / authBi) * 100) : 0
              return (
                <div key={s.id}>
                  <div className="flex items-baseline justify-between mb-1.5">
                    <span className="text-[12px]">{SERVICE_TYPE_LABELS[s.service_type]}</span>
                    <span className="font-mono text-[10.5px] text-ink-soft">
                      {fmtHours(planned)}h <span className="text-muted">/ {fmtHours(authBi)}h</span>
                    </span>
                  </div>
                  <div className="bar" style={{ height: 7 }}>
                    <span className={`bar-fill ${over ? 'bar-fill-orange' : 'bar-fill-mint'}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
