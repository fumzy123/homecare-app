import { useState } from 'react'
import { format } from 'date-fns'
import { Tag, ProgressBar } from '@/shared/components/ui'
import {
  useClientAuthorizations,
  useAuthorizationCompliance,
  useCancelAuthorization,
} from '../hooks/useAuthorizations'
import type { Authorization, ServiceCompliance, AuthorizationCompliance } from '../api'
import { SERVICE_TYPE_LABELS, HOURS_PERIOD_LABELS, STATUS_TAG } from '../constants'
import { AuthorizationDrawer } from './AuthorizationDrawer'

const labelClass = 'font-mono text-[9px] tracking-[0.1em] uppercase text-ink-soft'

function fmtHours(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

// ── Coverage alert ────────────────────────────────────────────────────────────

function CoverageAlert({ compliance }: { compliance: AuthorizationCompliance }) {
  if (compliance.coverage !== 'lapsed') return null
  return (
    <div className="border border-orange bg-orange-soft px-4 py-3">
      <p className="font-mono text-[10px] tracking-[0.08em] uppercase text-orange mb-0.5">⚠ Coverage Lapsed</p>
      <p className="text-[13px] text-ink">
        This active client has no current authorization. Renew with the funder to stay compliant.
      </p>
    </div>
  )
}

// ── Compliance indicator (planned vs authorized, per service) ─────────────────

function ComplianceRow({ s }: { s: ServiceCompliance }) {
  const exceeded   = s.status === 'exceeded'
  const variant    = exceeded ? 'orange' : s.status === 'approaching' ? 'orange' : 'mint'
  const pct        = s.authorized_biweekly > 0 ? (s.planned_biweekly / s.authorized_biweekly) * 100 : 0
  const noAuth     = s.authorized_biweekly === 0

  return (
    <div className="px-4 py-3">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-[13px]">{SERVICE_TYPE_LABELS[s.service_type]}</span>
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

// ── Authorization card ────────────────────────────────────────────────────────

function AuthorizationCard({
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
  const tag = STATUS_TAG[auth.status]
  const canModify = auth.status === 'active' || auth.status === 'pending'

  return (
    <div className="border border-ink bg-paper">
      <div className="flex items-center justify-between px-5 py-3 border-b border-ink">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[12px] font-bold tracking-[0.04em]">{auth.authorization_number}</span>
          <Tag variant={tag.variant}>{tag.label}</Tag>
        </div>
        <span className={labelClass}>{HOURS_PERIOD_LABELS[auth.hours_period]}</span>
      </div>

      <div className="px-5 py-4 grid grid-cols-2 gap-4">
        <div>
          <p className={labelClass}>Funder</p>
          <p className="text-[13px]">{auth.funder}</p>
          {auth.funder_file_number && (
            <p className="font-mono text-[10px] text-ink-soft mt-0.5">File #{auth.funder_file_number}</p>
          )}
        </div>
        <div>
          <p className={labelClass}>Covering Period</p>
          <p className="text-[13px]">
            {format(new Date(auth.covering_start), 'MMM d, yyyy')}
            {' – '}
            {auth.covering_end ? format(new Date(auth.covering_end), 'MMM d, yyyy') : 'open-ended'}
          </p>
        </div>
      </div>

      <div className="px-5 pb-4">
        <p className={`${labelClass} mb-1.5`}>Authorized Services</p>
        <div className="flex flex-wrap gap-2">
          {auth.services.map((svc) => (
            <span key={svc.id} className="border border-line-soft bg-cream px-2.5 py-1 font-mono text-[11px]">
              {SERVICE_TYPE_LABELS[svc.service_type]} · <b>{fmtHours(svc.authorized_hours)}h</b>
            </span>
          ))}
        </div>
        {auth.client_monthly_contribution_amount != null && auth.client_monthly_contribution_amount > 0 && (
          <p className="mt-2 font-mono text-[10px] text-ink-soft">
            Client contribution: ${fmtHours(auth.client_monthly_contribution_amount)}/month
          </p>
        )}
        {auth.notes && <p className="mt-2 text-[12px] text-ink-soft italic">{auth.notes}</p>}
      </div>

      {canModify && (
        <div className="flex items-center gap-2 px-5 py-3 border-t border-line-soft">
          <button
            onClick={() => onAmend(auth)}
            className="font-mono text-[10px] tracking-[0.05em] uppercase text-ink-soft hover:text-ink"
          >
            Amend →
          </button>
          <span className="text-line-soft">·</span>
          {confirmCancel ? (
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] text-orange">Cancel this authorization?</span>
              <button
                onClick={() => onCancel(auth.id)}
                disabled={cancelling}
                className="font-mono text-[10px] uppercase tracking-[0.05em] text-orange hover:underline disabled:opacity-40"
              >
                {cancelling ? '…' : 'Confirm'}
              </button>
              <button
                onClick={() => setConfirmCancel(false)}
                className="font-mono text-[10px] uppercase tracking-[0.05em] text-ink-soft hover:text-ink"
              >
                Keep
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmCancel(true)}
              className="font-mono text-[10px] tracking-[0.05em] uppercase text-ink-soft hover:text-orange"
            >
              Cancel
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Section ───────────────────────────────────────────────────────────────────

export function ClientAuthorizationSection({ clientId }: { clientId: string }) {
  const { data: authorizations = [], isLoading } = useClientAuthorizations(clientId)
  const { data: compliance } = useAuthorizationCompliance(clientId)
  const { mutate: cancel, isPending: cancelling } = useCancelAuthorization(clientId)

  const [drawer, setDrawer] = useState<{ mode: 'create' | 'amend'; amends?: Authorization } | null>(null)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-[22px] leading-none tracking-[-0.02em]">Funding &amp; Authorization</h2>
        <button
          onClick={() => setDrawer({ mode: 'create' })}
          className="bg-ink text-cream px-4 py-2 font-mono text-[10px] uppercase tracking-[0.06em] hover:bg-orange transition-colors"
        >
          ＋ Add Authorization
        </button>
      </div>

      {compliance && <CoverageAlert compliance={compliance} />}

      {/* Compliance — planned care vs authorized envelope */}
      {compliance && compliance.services.length > 0 && (
        <div className="border border-ink bg-paper">
          <div className="px-5 py-3 border-b border-ink">
            <p className={labelClass}>Planned vs Authorized</p>
          </div>
          <div className="divide-y divide-dashed divide-line-soft">
            {compliance.services.map((s) => <ComplianceRow key={s.service_type} s={s} />)}
          </div>
        </div>
      )}

      {/* Authorizations */}
      {isLoading ? (
        <p className="font-mono text-[10px] text-muted tracking-wide">LOADING…</p>
      ) : authorizations.length === 0 ? (
        <div className="border border-dashed border-ink px-8 py-10 text-center">
          <p className="font-serif text-[20px] mb-1">No authorizations yet</p>
          <p className="font-mono text-[10px] text-muted tracking-wide">
            ADD THE FUNDER'S AUTHORIZATION TO TRACK HOURS AND COMPLIANCE
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {authorizations.map((auth) => (
            <AuthorizationCard
              key={auth.id}
              auth={auth}
              onAmend={(a) => setDrawer({ mode: 'amend', amends: a })}
              onCancel={cancel}
              cancelling={cancelling}
            />
          ))}
        </div>
      )}

      {drawer && (
        <AuthorizationDrawer
          clientId={clientId}
          amends={drawer.amends}
          onClose={() => setDrawer(null)}
        />
      )}
    </div>
  )
}
