import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { format, parseISO } from 'date-fns'
import { ArrowRight, FileText, Pencil, Plus, ShieldCheck } from 'lucide-react'
import {
  useClientAuthorizations,
  useCancelAuthorization,
} from '@/features/authorizations/hooks/useAuthorizations'
import { useCareNeedVersions } from '@/features/weekly-care-need/hooks/useWeeklyCareNeed'
import { AuthorizationDrawer } from '@/features/authorizations/components/AuthorizationDrawer'
import { fmtHours, totalAuthorizedHours } from '@/features/authorizations/utils'
import {
  HOURS_PERIOD_LABELS,
  SERVICE_TYPE_LABELS,
} from '@/features/authorizations/constants'
import type { Authorization } from '@/features/authorizations/api'
import { useClient } from '../hooks/useClients'
import {
  authorizationForDate,
  currentCareNeed,
  fundingRows,
  errorMessage,
} from '../lib/care'
import {
  ClientPanel,
  ClientEmpty,
  ClientLoading,
  ClientBadge,
  ClientDialog,
} from './ClientWorkspaceUI'

const dateLabel = (value: string | null) =>
  value ? format(parseISO(value), 'MMM d, yyyy') : 'Open-ended'
export function ClientFunding({
  clientId,
  attentionAuthorization,
}: {
  clientId: string
  attentionAuthorization?: string
}) {
  const client = useClient(clientId)
  const query = useClientAuthorizations(clientId)
  const needs = useCareNeedVersions(clientId)
  const cancel = useCancelAuthorization(clientId)
  const [form, setForm] = useState<{ amends?: Authorization } | null>(null)
  const [recordId, setRecordId] = useState<string | null>(
    attentionAuthorization || null,
  )
  const [confirmCancel, setConfirmCancel] = useState(false)
  const today = format(new Date(), 'yyyy-MM-dd')
  if (query.isPending || query.isError)
    return (
      <ClientLoading error={query.isError} retry={() => void query.refetch()} />
    )
  if (client.data?.care_arrangement === 'self_pay')
    return (
      <ClientPanel title="Self-pay care">
        <div className="cw-panel-body">
          <p>No funding authorization is required.</p>
          <Link
            className="cw-link mt-5"
            to="/dashboard/clients/$clientId/care-need"
            params={{ clientId }}
          >
            View weekly care need <ArrowRight size={15} />
          </Link>
        </div>
      </ClientPanel>
    )
  const auths = query.data || []
  const auth = authorizationForDate(auths, today)
  const current = currentCareNeed(needs.data || [], today)
  const rows = fundingRows(auth, current?.care_slots || [])
  const record = auths.find((a) => a.id === recordId)
  return (
    <div className="cw-stack">
      <header className="cw-between">
        <div>
          <p className="cw-label mb-2">Authorizations & service limits</p>
          <h2>Funding</h2>
        </div>
        <button className="cw-btn cw-btn-primary" onClick={() => setForm({})}>
          <Plus size={15} /> Add authorization
        </button>
      </header>
      {attentionAuthorization &&
        !auths.some((a) => a.id === attentionAuthorization) && (
          <p role="status" className="cw-error">
            The requested authorization is no longer available.
          </p>
        )}
      {auth ? (
        <section className="cw-panel cw-panel-body">
          <div className="cw-columns">
            <div>
              <div className="cw-row">
                <ClientBadge tone="mint">
                  <ShieldCheck size={13} /> Active authorization
                </ClientBadge>
                <span className="cw-label">{auth.authorization_number}</span>
              </div>
              <h2 className="mt-5">{auth.funder}</h2>
              <p className="cw-muted mt-3">
                {auth.services.length} authorized services
              </p>
              <div className="cw-row mt-6">
                <button
                  className="cw-btn"
                  onClick={() => setForm({ amends: auth })}
                >
                  <Pencil size={14} /> Amend authorization
                </button>
                <button className="cw-btn" onClick={() => setRecordId(auth.id)}>
                  <FileText size={14} /> View record
                </button>
              </div>
            </div>
            <div className="cw-stack">
              <div>
                <p className="cw-label mb-2">Authorized period</p>
                <p>
                  {dateLabel(auth.covering_start)} –{' '}
                  {dateLabel(auth.covering_end)}
                </p>
              </div>
              <div>
                <p className="cw-label mb-2">Funding frequency</p>
                <p>{HOURS_PERIOD_LABELS[auth.hours_period]} · per service</p>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <ClientEmpty title="No active authorization">
          Add an authorization covering the current care period.
        </ClientEmpty>
      )}
      <ClientPanel title="Funding allowance & care need">
        {needs.isPending || needs.isError ? (
          <ClientLoading
            error={needs.isError}
            retry={() => void needs.refetch()}
          />
        ) : !current ? (
          <ClientEmpty title="No current weekly care need">
            <Link
              className="cw-link"
              to="/dashboard/clients/$clientId/care-need"
              params={{ clientId }}
            >
              View weekly care need
            </Link>
          </ClientEmpty>
        ) : (
          <>
            <div className="cw-between cw-panel-body">
              <span className="text-sm">
                Current care need · Revision {current.version}
              </span>
              <div className="cw-muted text-right">
                Starts{' '}
                {dateLabel(current.scheduled_from || current.effective_from)}
                <br />
                {auth
                  ? `Authorization ${auth.authorization_number}`
                  : 'No current authorization'}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="cw-table">
                <thead>
                  <tr>
                    <th>Service</th>
                    <th>
                      Authorized limit<small>per 2 weeks</small>
                    </th>
                    <th>
                      Care needed<small>per 2 weeks</small>
                    </th>
                    <th>
                      Unused allowance<small>per 2 weeks</small>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.service}>
                      <td>{SERVICE_TYPE_LABELS[row.service]}</td>
                      <td>{fmtHours(row.limit)}h</td>
                      <td>
                        {fmtHours(row.needed)}h
                        <small>{fmtHours(row.weekly)}h / week × 2</small>
                      </td>
                      <td className={row.remaining < 0 ? 'text-orange' : ''}>
                        {row.remaining < 0
                          ? `${fmtHours(-row.remaining)}h over limit`
                          : `${fmtHours(row.remaining)}h`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="cw-muted cw-panel-body border-t border-line-soft">
              Authorization is a limit, not a target. Allowances are separate
              for each service.
            </p>
          </>
        )}
      </ClientPanel>
      <section>
        <h3 className="mb-5">Authorization history</h3>
        {auths.length ? (
          <div className="cw-table-scroll">
            <table className="cw-table">
              <thead>
                <tr>
                  {['Reference', 'Period', 'Total limit', 'Status', ''].map(
                    (h, i) => (
                      <th key={i}>{h}</th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {auths.map((a) => (
                  <tr key={a.id}>
                    <td>{a.authorization_number}</td>
                    <td>
                      {dateLabel(a.covering_start)} –{' '}
                      {dateLabel(a.covering_end)}
                    </td>
                    <td>
                      {fmtHours(totalAuthorizedHours(a))}h
                      <small>{HOURS_PERIOD_LABELS[a.hours_period]}</small>
                    </td>
                    <td>
                      <ClientBadge
                        tone={
                          a.status === 'active'
                            ? 'mint'
                            : a.status === 'pending'
                              ? 'yellow'
                              : ''
                        }
                      >
                        {a.status}
                      </ClientBadge>
                    </td>
                    <td>
                      <button
                        className="cw-link"
                        aria-label={`View authorization ${a.authorization_number}`}
                        onClick={() => {
                          setRecordId(a.id)
                          setConfirmCancel(false)
                        }}
                      >
                        View <ArrowRight size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="cw-muted">No authorizations recorded.</p>
        )}
      </section>
      {form && (
        <AuthorizationDrawer
          clientId={clientId}
          amends={form.amends}
          onClose={() => setForm(null)}
        />
      )}
      {record && (
        <ClientDialog
          title="Authorization details"
          onClose={() => {
            setRecordId(null)
            setConfirmCancel(false)
          }}
        >
          <div className="cw-stack">
            <ClientBadge tone={record.status === 'active' ? 'mint' : ''}>
              {record.status}
            </ClientBadge>
            <h3>{record.funder}</h3>
            <dl className="cw-form-grid">
              {[
                ['Reference', record.authorization_number],
                ['Funder file', record.funder_file_number],
                ['Starts', dateLabel(record.covering_start)],
                ['Ends', dateLabel(record.covering_end)],
                ['Issued', record.date_issued && dateLabel(record.date_issued)],
                ['Authorized by', record.authorized_by],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="cw-label">{label}</dt>
                  <dd className="mt-2">{value || 'Not recorded'}</dd>
                </div>
              ))}
            </dl>
            <ClientPanel title="Authorized services">
              <div className="cw-panel-body cw-stack">
                {record.services.map((s) => (
                  <div key={s.id} className="cw-between">
                    <span>{SERVICE_TYPE_LABELS[s.service_type]}</span>
                    <span>
                      {fmtHours(s.authorized_hours)}h ·{' '}
                      {HOURS_PERIOD_LABELS[record.hours_period]}
                    </span>
                  </div>
                ))}
              </div>
            </ClientPanel>
            {record.notes && (
              <p className="whitespace-pre-wrap">{record.notes}</p>
            )}
            {record.invoice_to && (
              <p className="cw-muted">Invoice to: {record.invoice_to}</p>
            )}
            {record.client_monthly_contribution_amount != null && (
              <p className="cw-muted">
                Monthly contribution: $
                {record.client_monthly_contribution_amount.toFixed(2)}
              </p>
            )}
            {['active', 'pending'].includes(record.status) && (
              <div>
                {confirmCancel ? (
                  <>
                    <p className="text-sm mb-3">
                      Cancel this authorization? The record will remain in
                      history.
                    </p>
                    <div className="cw-row">
                      <button
                        className="cw-btn"
                        disabled={cancel.isPending}
                        onClick={() =>
                          cancel.mutate(record.id, {
                            onSuccess: () => setConfirmCancel(false),
                          })
                        }
                      >
                        Confirm cancellation
                      </button>
                      <button
                        className="cw-link"
                        onClick={() => setConfirmCancel(false)}
                      >
                        Keep authorization
                      </button>
                    </div>
                  </>
                ) : (
                  <button
                    className="cw-link text-orange"
                    onClick={() => setConfirmCancel(true)}
                  >
                    Cancel authorization
                  </button>
                )}
              </div>
            )}
            {cancel.isError && (
              <p role="alert" className="cw-error">
                {errorMessage(cancel.error)}
              </p>
            )}
          </div>
        </ClientDialog>
      )}
    </div>
  )
}
