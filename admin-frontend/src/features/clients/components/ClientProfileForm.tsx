import { useEffect, useId, useState } from 'react'
import { useForm, useStore } from '@tanstack/react-form'
import { z } from 'zod'
import { format } from 'date-fns'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'
import { useUnsavedChanges } from '@/features/attention/hooks/useUnsavedChanges'
import { normalizePhone, validatePhone } from '@/shared/lib/phone'
import { PhoneInput } from '@/shared/components/PhoneInput'
import { useSaveClient } from '../hooks/useClients'
import type { Client, ClientStatus } from '../api'
import { ClientPanel } from './ClientWorkspaceUI'
import { ClientDangerZone } from './ClientDangerZone'
import { HelpTooltip } from '@/shared/components/HelpTooltip'
import { errorMessage } from '../lib/care'
import { formatPostalCode } from '../lib/address'
import { AddressAutocomplete } from './AddressAutocomplete'

const required = z.string().trim().min(1, 'Required')
const schema = z.object({
  first_name: required,
  last_name: required,
  date_of_birth: required,
  street: required,
  city: required,
  province: required,
  postal_code: required,
  emergency_contact_name: required,
  emergency_contact_phone: required,
  emergency_contact_relationship: required,
  email: z.union([z.literal(''), z.email('Enter a valid email')]),
})
const sections = [
  {
    title: 'Personal information',
    fields: ['first_name', 'last_name', 'date_of_birth', 'gender', 'status'],
  },
  {
    title: 'Contact & home',
    fields: [
      'phone_number',
      'email',
      'street',
      'city',
      'province',
      'postal_code',
    ],
  },
  {
    title: 'Emergency contact',
    fields: [
      'emergency_contact_name',
      'emergency_contact_relationship',
      'emergency_contact_phone',
    ],
  },
  {
    title: 'Care profile',
    fields: [
      'medical_conditions',
      'allergies',
      'medications',
      'special_instructions',
      'notes',
    ],
  },
] as const
const labels: Record<string, string> = {
  first_name: 'First name',
  last_name: 'Last name',
  date_of_birth: 'Date of birth',
  gender: 'Gender',
  status: 'Client status',
  phone_number: 'Phone',
  email: 'Email',
  street: 'Street address',
  city: 'City',
  province: 'Province',
  postal_code: 'Postal code',
  emergency_contact_name: 'Contact name',
  emergency_contact_relationship: 'Relationship',
  emergency_contact_phone: 'Contact phone',
  medical_conditions: 'Medical conditions',
  allergies: 'Allergies',
  medications: 'Medications',
  special_instructions: 'Care instructions',
  notes: 'Agency notes',
}
const optionalKeys = [
  'gender',
  'phone_number',
  'email',
  'medical_conditions',
  'allergies',
  'medications',
  'special_instructions',
  'notes',
] as const
export function ClientProfileForm({
  client,
  onCancel,
  onSuccess,
  onDirtyChange,
  onBusyChange,
}: {
  client?: Client
  onCancel: () => void
  onSuccess: (saved: Client) => void
  onDirtyChange?: (dirty: boolean) => void
  onBusyChange?: (busy: boolean) => void
}) {
  const save = useSaveClient(client?.id)
  const statusId = useId()
  const [step, setStep] = useState(0)
  const [error, setError] = useState('')
  const form = useForm({
    defaultValues: {
      first_name: client?.first_name || '',
      last_name: client?.last_name || '',
      date_of_birth: client?.date_of_birth?.slice(0, 10) || '',
      gender: client?.gender || '',
      status: client?.status || ('active' as ClientStatus),
      phone_number: client?.phone_number || '',
      email: client?.email || '',
      street: client?.street || '',
      city: client?.city || '',
      province: client?.province || '',
      postal_code: formatPostalCode(client?.postal_code || ''),
      emergency_contact_name: client?.emergency_contact_name || '',
      emergency_contact_relationship:
        client?.emergency_contact_relationship || '',
      emergency_contact_phone: client?.emergency_contact_phone || '',
      medical_conditions: client?.medical_conditions || '',
      allergies: client?.allergies || '',
      medications: client?.medications || '',
      special_instructions: client?.special_instructions || '',
      notes: client?.notes || '',
    },
    onSubmit: async ({ value }) => {
      if (!check(true)) return
      setError('')
      try {
        const saved = await save.mutateAsync({
          ...value,
          ...Object.fromEntries(
            optionalKeys.map((key) => [key, value[key].trim() || null]),
          ),
          postal_code: formatPostalCode(value.postal_code),
          phone_number: normalizePhone(value.phone_number),
          emergency_contact_phone: normalizePhone(value.emergency_contact_phone)!,
        })
        onSuccess(saved)
      } catch (err) {
        setError(errorMessage(err))
      }
    },
  })
  const dirty = useStore(form.store, (s) => Object.entries(s.values).some(
    ([key, value]) => value !== form.options.defaultValues?.[key as keyof typeof s.values],
  ))
  useUnsavedChanges(dirty && !save.isPending && !save.isSuccess)
  useEffect(() => {
    onDirtyChange?.(dirty)
  }, [dirty, onDirtyChange])
  useEffect(() => {
    onBusyChange?.(save.isPending)
  }, [save.isPending, onBusyChange])
  const visibleSections = client
    ? sections
    : step === 0
      ? sections.slice(0, 1)
      : step === 1
        ? sections.slice(1, 3)
        : sections.slice(3)
  function check(all = false) {
    const value = form.state.values
    const checked = new Set<string>(
      (all ? sections : visibleSections).flatMap((s) => [...s.fields]),
    )
    const result = schema.safeParse(value)
    const issue = !result.success
      ? result.error.issues.find((i) => checked.has(String(i.path[0])))
      : undefined
    if (issue) {
      setError(`${labels[String(issue.path[0])]}: ${issue.message}`)
      return false
    }
    if (
      checked.has('date_of_birth') &&
      value.date_of_birth > format(new Date(), 'yyyy-MM-dd')
    ) {
      setError('Date of birth cannot be in the future.')
      return false
    }
    for (const key of ['phone_number', 'emergency_contact_phone'] as const) {
      if (checked.has(key)) {
        const message = validatePhone(
          value[key],
          key === 'emergency_contact_phone',
        )
        if (message) {
          setError(`${labels[key]}: ${message}`)
          return false
        }
      }
    }
    setError('')
    return true
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (!client && step < 2) {
          if (check()) setStep((s) => s + 1)
        } else void form.handleSubmit()
      }}
      className="cw-stack"
    >
      {!client && (
        <div className="cw-row" aria-label="Intake steps">
          {['Personal', 'Contact & home', 'Care details'].map((label, i) => (
            <span
              key={label}
              className={`cw-badge ${step === i ? 'cw-mint' : ''}`}
              aria-current={step === i ? 'step' : undefined}
            >
              {i + 1} · {label}
            </span>
          ))}
        </div>
      )}
      {visibleSections.map((section) => (
        <ClientPanel key={section.title} title={section.title}>
          <div className="cw-panel-body cw-form-grid">
            {section.fields.map((name) => (
              <form.Field key={name} name={name}>
                {(field) => {
                  const options =
                    name === 'status'
                      ? ['active', 'on_hold', 'discharged']
                        : name === 'gender'
                          ? [
                              '',
                              'female',
                              'male',
                              'non_binary',
                              'prefer_not_to_say',
                            ]
                          : name === 'province'
                            ? [
                                '',
                                'AB',
                                'BC',
                                'MB',
                                'NB',
                                'NL',
                                'NS',
                                'NT',
                                'NU',
                                'ON',
                                'PE',
                                'QC',
                                'SK',
                                'YT',
                              ]
                            : null
                  const long = [
                    'medical_conditions',
                    'allergies',
                    'medications',
                    'special_instructions',
                    'notes',
                  ].includes(name)
                  if (name === 'phone_number' || name === 'emergency_contact_phone') return (
                    <PhoneInput label={labels[name]} value={field.state.value}
                      onChange={field.handleChange} onBlur={field.handleBlur}
                      required={name === 'emergency_contact_phone'} inputClassName="cw-input"
                      labelClassName="text-xs" />
                  )
                  if (name === 'street') return (
                    <AddressAutocomplete value={field.state.value}
                      onChange={field.handleChange} onBlur={field.handleBlur}
                      onSelect={(address) => {
                        field.handleChange(address.street)
                        form.setFieldValue('city', address.city)
                        form.setFieldValue('province', address.province)
                        form.setFieldValue('postal_code', formatPostalCode(address.postal_code))
                      }} />
                  )
                  if (name === 'status') return (
                    <div className="cw-field">
                      <HelpTooltip
                        id={`${statusId}-help`}
                        buttonLabel="About client status"
                        tone="light"
                        text={<>
                          <span className="block mb-2">Where this client is in their care relationship with your agency.</span>
                          <span className="block mb-1"><strong>Active:</strong> Currently receiving care or being set up for care.</span>
                          <span className="block mb-1"><strong>On hold:</strong> Care is temporarily paused.</span>
                          <span className="block"><strong>Discharged:</strong> The client is no longer receiving care from your agency.</span>
                        </>}
                      >
                        <label htmlFor={statusId}>Client status</label>
                      </HelpTooltip>
                      <select
                        id={statusId}
                        className="cw-input"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value as ClientStatus)}
                        onBlur={field.handleBlur}
                      >
                        <option value="active">Active</option>
                        <option value="on_hold">On hold</option>
                        <option value="discharged">Discharged</option>
                      </select>
                    </div>
                  )
                  if (name === 'special_instructions' || name === 'notes') return (
                    <div className="cw-field cw-form-full">
                      <HelpTooltip
                        id={`${statusId}-${name}-help`}
                        buttonLabel={`About ${labels[name].toLowerCase()}`}
                        tone="light"
                        text={name === 'special_instructions'
                          ? "Practical guidance shown to workers providing this client's care, such as routines, preferences and entry instructions."
                          : 'Internal information for agency staff. These notes are not shown to workers.'}
                      >
                        <label htmlFor={`${statusId}-${name}`}>{labels[name]}</label>
                      </HelpTooltip>
                      <textarea id={`${statusId}-${name}`} className="cw-input" rows={3}
                        value={field.state.value} onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                        aria-describedby={name === 'notes' ? `${statusId}-notes-private` : undefined} />
                      {name === 'notes' && <span id={`${statusId}-notes-private`} className="cw-muted">
                        Agency-only notes; not shown to workers.
                      </span>}
                    </div>
                  )
                  return (
                    <label className={`cw-field ${long ? 'cw-form-full' : ''}`}>
                      {labels[name]}
                      {name in schema.shape && name !== 'email' ? ' *' : ''}
                      {options ? (
                        <select
                          className="cw-input"
                          value={field.state.value}
                          onChange={(e) =>
                            field.handleChange(e.target.value as never)
                          }
                          onBlur={field.handleBlur}
                        >
                          {options.map((v) => (
                            <option key={v} value={v}>
                              {v
                                ? v
                                    .replaceAll('_', ' ')
                                    .replace(/^./, (s) => s.toUpperCase())
                                : 'Select…'}
                            </option>
                          ))}
                        </select>
                      ) : long ? (
                        <textarea
                          className="cw-input"
                          rows={3}
                          value={field.state.value}
                          onChange={(e) => field.handleChange(e.target.value)}
                          onBlur={field.handleBlur}
                        />
                      ) : (
                        <input
                          className="cw-input"
                          placeholder={
                            name.includes('phone')
                              ? '+1 709 555 0123'
                              : undefined
                          }
                          type={
                            name === 'date_of_birth'
                              ? 'date'
                              : name === 'email'
                                ? 'email'
                                : name.includes('phone')
                                  ? 'tel'
                                  : 'text'
                          }
                          max={
                            name === 'date_of_birth'
                              ? format(new Date(), 'yyyy-MM-dd')
                              : undefined
                          }
                          value={field.state.value}
                          onChange={(e) => field.handleChange(e.target.value)}
                          onBlur={() => {
                            if (name === 'postal_code') field.handleChange(formatPostalCode(field.state.value))
                            field.handleBlur()
                          }}
                          autoComplete={name === 'postal_code' ? 'postal-code' : undefined}
                          required={name in schema.shape && name !== 'email'}
                        />
                      )}
                    </label>
                  )
                }}
              </form.Field>
            ))}
          </div>
        </ClientPanel>
      ))}
      {error && (
        <p role="alert" className="cw-error">
          {error}
        </p>
      )}
      <footer className="cw-between sticky bottom-0 bg-cream py-4 border-t border-line-soft">
        <button
          type="button"
          className="cw-btn"
          disabled={save.isPending}
          onClick={onCancel}
        >
          Cancel
        </button>
        <div className="cw-row">
          {!client && step > 0 && (
            <button
              type="button"
              className="cw-btn"
              disabled={save.isPending}
              onClick={() => {
                setStep((s) => s - 1)
                setError('')
              }}
            >
              <ArrowLeft size={14} /> Back
            </button>
          )}
          <button
            type="submit"
            className="cw-btn cw-btn-primary"
            disabled={save.isPending}
          >
            {save.isPending
              ? 'Saving…'
              : !client && step < 2
                ? 'Continue'
                : client
                  ? 'Save profile'
                  : 'Create client'}
            {!client && step < 2 ? (
              <ArrowRight size={14} />
            ) : (
              <Check size={14} />
            )}
          </button>
        </div>
      </footer>
      {client && <ClientDangerZone clientId={client.id} />}
    </form>
  )
}
