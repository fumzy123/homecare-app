import { MAX_INPUT_DATE } from '@/shared/lib/date'
import { useState } from 'react'
import { useForm, useStore } from '@tanstack/react-form'
import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { useUnsavedChanges } from '@/features/attention/hooks/useUnsavedChanges'
import { PhoneInput } from '@/shared/components/PhoneInput'
import { normalizePhone, validatePhone } from '@/shared/lib/phone'
import type { EmploymentType, OrgMember } from '@/features/org-members/api'
import { useWorker } from '../hooks/useWorkers'
import { useUpdateWorker } from '../hooks/useWorkerProfile'
import { WorkerLoading, WorkerPanel } from './WorkerProfileUI'
import { WorkerDangerZone } from './WorkerDangerZone'

export function WorkerProfileEditor({ workerId }: { workerId: string }) {
  const query = useWorker(workerId)
  if (query.isPending || !query.data)
    return (
      <WorkerLoading error={query.isError} retry={() => void query.refetch()} />
    )
  return (
    <>
      {query.isError && (
        <WorkerLoading error refresh retry={() => void query.refetch()} />
      )}
      <ProfileForm key={workerId} worker={query.data} />
    </>
  )
}

function ProfileForm({ worker }: { worker: OrgMember }) {
  const navigate = useNavigate(),
    update = useUpdateWorker(worker.id)
  const [error, setError] = useState('')
  const initial = {
    first_name: worker.first_name,
    last_name: worker.last_name,
    phone_number: worker.phone_number || '',
    gender: worker.gender || '',
    date_of_birth: worker.date_of_birth?.slice(0, 10) || '',
    hire_date: worker.hire_date?.slice(0, 10) || '',
    street: worker.street || '',
    city: worker.city || '',
    province: worker.province || '',
    postal_code: worker.postal_code || '',
    emergency_contact_name: worker.emergency_contact_name || '',
    emergency_contact_phone: worker.emergency_contact_phone || '',
    emergency_contact_relationship: worker.emergency_contact_relationship || '',
    is_active: worker.is_active,
    employment_type: worker.employment_type || '',
    max_hours_per_week: worker.max_hours_per_week?.toString() || '',
    has_vehicle:
      worker.has_vehicle == null ? '' : worker.has_vehicle ? 'yes' : 'no',
  }
  const form = useForm({
    defaultValues: initial,
    onSubmit: async ({ value }) => {
      setError('')
      const phoneError =
        validatePhone(value.phone_number) ||
        validatePhone(value.emergency_contact_phone)
      if (phoneError) {
        setError(phoneError)
        return
      }
      if (!value.first_name.trim() || !value.last_name.trim()) {
        setError('First and last name are required.')
        return
      }
      const cap =
        value.max_hours_per_week === ''
          ? null
          : Number(value.max_hours_per_week)
      if (cap != null && (!Number.isInteger(cap) || cap < 0)) {
        setError('Enter a whole number of hours, zero or greater.')
        return
      }
      try {
        await update.mutateAsync({
          ...value,
          first_name: value.first_name.trim(),
          last_name: value.last_name.trim(),
          phone_number: normalizePhone(value.phone_number),
          emergency_contact_phone: normalizePhone(
            value.emergency_contact_phone,
          ),
          employment_type: (value.employment_type ||
            null) as EmploymentType | null,
          max_hours_per_week: cap,
          has_vehicle:
            value.has_vehicle === '' ? null : value.has_vehicle === 'yes',
          date_of_birth: value.date_of_birth || null,
          hire_date: value.hire_date || null,
        })
        form.reset(value)
        await navigate({
          to: '/dashboard/workers/$workerId',
          params: { workerId: worker.id },
          // The saved draft is clean; isSubmitting is still true until this callback returns.
          ignoreBlocker: true,
        })
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Could not save the worker profile.',
        )
      }
    },
  })
  const dirty = useStore(form.store, (s) => s.isDirty),
    busy = useStore(form.store, (s) => s.isSubmitting)
  useUnsavedChanges(dirty, undefined, busy)
  const textField = (
    name: Exclude<keyof typeof initial, 'is_active'>,
    label: string,
    type = 'text',
    required = false,
  ) => (
    <form.Field name={name} key={name}>
      {(field) => (
        <label className="wp-field">
          {label}
          <input
            className="wp-input"
            type={type}
            max={type === 'date' ? MAX_INPUT_DATE : undefined}
            required={required}
            min={type === 'number' ? 0 : undefined}
            step={type === 'number' ? 1 : undefined}
            value={field.state.value}
            onBlur={field.handleBlur}
            onChange={(e) => field.handleChange(e.target.value)}
          />
        </label>
      )}
    </form.Field>
  )
  return (
    <div className="wp-editor">
      <div className="wp-breadcrumb">
        <Link
          to="/dashboard/workers/$workerId"
          params={{ workerId: worker.id }}
          className="wp-row"
          disabled={busy}
        >
          <ArrowLeft size={15} />
          Back to {worker.first_name}
        </Link>
      </div>
      <div className="wp-section-heading">
        <h1>
          Edit{' '}
          <em>
            {worker.first_name} {worker.last_name}
          </em>
        </h1>
        <p className="wp-muted">
          Personal details, emergency contact, and employment.
        </p>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (!busy) void form.handleSubmit()
        }}
      >
        <fieldset disabled={busy}>
          <WorkerPanel title="Personal details">
            <div className="wp-form-grid">
              {textField('first_name', 'First name', 'text', true)}
              {textField('last_name', 'Last name', 'text', true)}
              <form.Field name="phone_number">
                {(field) => (
                  <PhoneInput
                    label="Phone number"
                    value={field.state.value}
                    onChange={field.handleChange}
                    onBlur={field.handleBlur}
                    inputClassName="wp-input"
                  />
                )}
              </form.Field>
              <div className="wp-field">
                <span>Email</span>
                <p>{worker.email}</p>
              </div>
              {textField('date_of_birth', 'Date of birth', 'date')}
              {textField('gender', 'Gender')}
              {textField('street', 'Street address')}
              {textField('city', 'City')}
              {textField('province', 'Province')}
              {textField('postal_code', 'Postal code')}
            </div>
          </WorkerPanel>
          <WorkerPanel title="Emergency contact">
            <div className="wp-form-grid">
              {textField('emergency_contact_name', 'Contact name')}
              {textField('emergency_contact_relationship', 'Relationship')}
              <form.Field name="emergency_contact_phone">
                {(field) => (
                  <PhoneInput
                    label="Emergency contact phone"
                    value={field.state.value}
                    onChange={field.handleChange}
                    onBlur={field.handleBlur}
                    inputClassName="wp-input"
                  />
                )}
              </form.Field>
            </div>
          </WorkerPanel>
          <WorkerPanel title="Employment">
            <div className="wp-form-grid">
              <form.Field name="is_active">
                {(field) => (
                  <label className="wp-field">
                    Status
                    <select
                      className="wp-input"
                      value={field.state.value ? 'active' : 'inactive'}
                      onChange={(e) =>
                        field.handleChange(e.target.value === 'active')
                      }
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </label>
                )}
              </form.Field>
              <form.Field name="employment_type">
                {(field) => (
                  <label className="wp-field">
                    Employment type
                    <select
                      className="wp-input"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                    >
                      <option value="">Not recorded</option>
                      <option value="full_time">Full-time</option>
                      <option value="part_time">Part-time</option>
                    </select>
                  </label>
                )}
              </form.Field>
              {textField('hire_date', 'Hire date', 'date')}
              {textField(
                'max_hours_per_week',
                'Weekly limit (hours)',
                'number',
              )}
              <form.Field name="has_vehicle">
                {(field) => (
                  <label className="wp-field">
                    Vehicle
                    <select
                      className="wp-input"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                    >
                      <option value="">Not recorded</option>
                      <option value="yes">Has a vehicle</option>
                      <option value="no">No vehicle</option>
                    </select>
                  </label>
                )}
              </form.Field>
            </div>
            <p className="wp-muted wp-gap">
              Recurring availability is managed in Schedule. Credentials are
              managed in Documents.
            </p>
          </WorkerPanel>
          {error && (
            <p role="alert" className="wp-error">
              {error}
            </p>
          )}
          <div className="wp-actions">
            {dirty && <span className="wp-muted">Unsaved changes</span>}
            <Link
              className="wp-btn"
              disabled={busy}
              to="/dashboard/workers/$workerId"
              params={{ workerId: worker.id }}
            >
              Cancel
            </Link>
            <button type="submit" className="wp-btn wp-primary">
              {busy ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </fieldset>
      </form>
      <details>
        <summary>Worker access</summary>
        <div className="wp-gap">
          <WorkerDangerZone worker={worker} disabled={busy} />
        </div>
      </details>
    </div>
  )
}
