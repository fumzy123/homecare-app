import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { ClientDialog } from '@/features/clients/components/ClientWorkspaceUI'
import { errorMessage } from '@/features/clients/lib/care'
import { useCreateAuthorization } from '../hooks/useAuthorizations'
import {
  SERVICE_TYPES,
  SERVICE_TYPE_LABELS,
  HOURS_PERIOD_LABELS,
} from '../constants'
import type {
  Authorization,
  AuthorizationCreatePayload,
  HoursPeriod,
  ServiceType,
} from '../api'

export function AuthorizationDrawer({
  clientId,
  amends,
  onClose,
}: {
  clientId: string
  amends?: Authorization
  onClose: () => void
}) {
  const create = useCreateAuthorization(clientId)
  const [error, setError] = useState('')
  const [values, setValues] = useState({
    funder: amends?.funder || '',
    authorization_number: amends?.authorization_number || '',
    funder_file_number: amends?.funder_file_number || '',
    covering_start: amends?.covering_start || '',
    covering_end: amends?.covering_end || '',
    date_issued: amends?.date_issued || '',
    authorized_by: amends?.authorized_by || '',
    hours_period: amends?.hours_period || ('bi_weekly' as HoursPeriod),
    contribution: amends?.client_monthly_contribution_amount?.toString() || '',
    invoice_to: amends?.invoice_to || '',
    notes: '',
  })
  const [rows, setRows] = useState(
    () =>
      amends?.services.map((s) => ({
        key: crypto.randomUUID(),
        service_type: s.service_type as ServiceType | '',
        hours: String(s.authorized_hours),
      })) || [
        {
          key: crypto.randomUUID(),
          service_type: '' as ServiceType | '',
          hours: '',
        },
      ],
  )
  const set = (key: keyof typeof values, value: string) =>
    setValues((prev) => ({ ...prev, [key]: value }))
  const [dirty, setDirty] = useState(false)
  const close = () => {
    if (create.isPending) return
    if (!dirty || window.confirm('Discard your unsaved authorization?'))
      onClose()
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (
      !rows.length ||
      rows.some(
        (r) =>
          !r.service_type ||
          !Number.isFinite(Number(r.hours)) ||
          Number(r.hours) <= 0,
      )
    ) {
      setError('Select a service and enter positive hours for every row.')
      return
    }
    if (new Set(rows.map((r) => r.service_type)).size !== rows.length) {
      setError('Each service can only appear once.')
      return
    }
    if (values.covering_end && values.covering_end < values.covering_start) {
      setError('End date must be on or after the start date.')
      return
    }
    const payload: AuthorizationCreatePayload = {
      funder: values.funder.trim(),
      authorization_number: values.authorization_number.trim(),
      covering_start: values.covering_start,
      covering_end: values.covering_end || null,
      funder_file_number: values.funder_file_number || null,
      date_issued: values.date_issued || null,
      authorized_by: values.authorized_by || null,
      hours_period: values.hours_period,
      client_monthly_contribution_amount: values.contribution
        ? Number(values.contribution)
        : null,
      invoice_to: values.invoice_to || null,
      notes: values.notes || null,
      supersedes_id: amends?.id || null,
      services: rows.map((r) => ({
        service_type: r.service_type as ServiceType,
        authorized_hours: Number(r.hours),
      })),
    }
    try {
      await create.mutateAsync(payload)
      onClose()
    } catch (err) {
      setError(errorMessage(err))
    }
  }
  return (
    <ClientDialog
      title={amends ? 'Amend authorization' : 'Add authorization'}
      onClose={close}
    >
      <form
        className="cw-stack"
        onSubmit={(e) => void submit(e)}
        onChange={() => setDirty(true)}
      >
        {amends && (
          <p className="cw-muted">
            Previous authorization retained: {amends.authorization_number}
          </p>
        )}
        <div className="cw-form-grid">
          <label className="cw-field cw-form-full">
            Funder *
            <input
              className="cw-input"
              value={values.funder}
              onChange={(e) => set('funder', e.target.value)}
              required
            />
          </label>
          <label className="cw-field">
            Reference *
            <input
              className="cw-input"
              value={values.authorization_number}
              onChange={(e) => set('authorization_number', e.target.value)}
              required
            />
          </label>
          <label className="cw-field">
            Funding frequency
            <select
              className="cw-input"
              value={values.hours_period}
              onChange={(e) => set('hours_period', e.target.value)}
            >
              {(Object.keys(HOURS_PERIOD_LABELS) as HoursPeriod[]).map((p) => (
                <option key={p} value={p}>
                  {HOURS_PERIOD_LABELS[p]}
                </option>
              ))}
            </select>
          </label>
          <label className="cw-field">
            Start date *
            <input
              type="date"
              className="cw-input"
              value={values.covering_start}
              onChange={(e) => set('covering_start', e.target.value)}
              required
            />
          </label>
          <label className="cw-field">
            End date
            <input
              type="date"
              className="cw-input"
              min={values.covering_start}
              value={values.covering_end}
              onChange={(e) => set('covering_end', e.target.value)}
            />
          </label>
        </div>
        <section>
          <div className="cw-between mb-5">
            <h3>Authorized services</h3>
            <span className="cw-muted">
              {HOURS_PERIOD_LABELS[values.hours_period]} limits
            </span>
          </div>
          <div className="cw-stack">
            {rows.map((row, index) => (
              <div
                key={row.key}
                className="grid grid-cols-[minmax(0,1fr)_110px_auto] gap-3 items-end"
              >
                <label className="cw-field">
                  Service
                  <select
                    aria-label={`Authorized service ${index + 1}`}
                    className="cw-input"
                    value={row.service_type}
                    onChange={(e) =>
                      setRows((prev) =>
                        prev.map((r) =>
                          r.key === row.key
                            ? {
                                ...r,
                                service_type: e.target.value as ServiceType,
                              }
                            : r,
                        ),
                      )
                    }
                    required
                  >
                    <option value="">Select service</option>
                    {SERVICE_TYPES.map((s) => (
                      <option key={s} value={s}>
                        {SERVICE_TYPE_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="cw-field">
                  Hours
                  <input
                    aria-label={`Authorized hours ${index + 1}`}
                    className="cw-input"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={row.hours}
                    onChange={(e) =>
                      setRows((prev) =>
                        prev.map((r) =>
                          r.key === row.key
                            ? { ...r, hours: e.target.value }
                            : r,
                        ),
                      )
                    }
                    required
                  />
                </label>
                <button
                  type="button"
                  className="cw-icon"
                  aria-label={`Remove service ${index + 1}`}
                  onClick={() => {
                    setRows((prev) => prev.filter((r) => r.key !== row.key))
                    setDirty(true)
                  }}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="cw-btn mt-5"
            onClick={() => {
              setRows((prev) => [
                ...prev,
                { key: crypto.randomUUID(), service_type: '', hours: '' },
              ])
              setDirty(true)
            }}
          >
            <Plus size={15} /> Add service
          </button>
        </section>
        <details>
          <summary className="cw-link">
            Additional authorization details
          </summary>
          <div className="cw-form-grid mt-5">
            {(
              [
                ['funder_file_number', 'Funder file number'],
                ['date_issued', 'Date issued'],
                ['authorized_by', 'Authorized by'],
                ['contribution', 'Monthly contribution'],
              ] as const
            ).map(([key, label]) => (
              <label className="cw-field" key={key}>
                {label}
                <input
                  className="cw-input"
                  type={
                    key === 'date_issued'
                      ? 'date'
                      : key === 'contribution'
                        ? 'number'
                        : 'text'
                  }
                  min={key === 'contribution' ? 0 : undefined}
                  step={key === 'contribution' ? '0.01' : undefined}
                  value={values[key]}
                  onChange={(e) => set(key, e.target.value)}
                />
              </label>
            ))}
            <label className="cw-field cw-form-full">
              Invoice to
              <textarea
                className="cw-input"
                rows={2}
                value={values.invoice_to}
                onChange={(e) => set('invoice_to', e.target.value)}
              />
            </label>
          </div>
        </details>
        <label className="cw-field">
          Reason / notes
          <textarea
            className="cw-input"
            rows={3}
            value={values.notes}
            onChange={(e) => set('notes', e.target.value)}
          />
        </label>
        {error && (
          <p role="alert" className="cw-error">
            {error}
          </p>
        )}
        <footer className="cw-row justify-end">
          <button
            type="button"
            className="cw-btn"
            onClick={close}
            disabled={create.isPending}
          >
            Cancel
          </button>
          <button
            className="cw-btn cw-btn-primary"
            type="submit"
            disabled={create.isPending}
          >
            {create.isPending
              ? 'Saving…'
              : amends
                ? 'Save amendment'
                : 'Save authorization'}
          </button>
        </footer>
      </form>
    </ClientDialog>
  )
}
