import { useEffect, useState } from 'react'
import { useForm, useStore } from '@tanstack/react-form'
import { z } from 'zod'
import { format } from 'date-fns'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'
import { useUnsavedChanges } from '@/features/attention/hooks/useUnsavedChanges'
import { useOrganization } from '@/features/organization/hooks/useOrganization'
import { validatePhone } from '@/shared/lib/phone'
import { useSaveClient } from '../hooks/useClients'
import type { Client, ClientStatus, CareArrangement } from '../api'
import { ClientPanel } from './ClientWorkspaceUI'
import { ClientDangerZone } from './ClientDangerZone'
import { errorMessage } from '../lib/care'

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
      'care_arrangement',
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
  care_arrangement: 'Care arrangement',
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
}: {
  client?: Client
  onCancel: () => void
  onSuccess: () => void
  onDirtyChange?: (dirty: boolean) => void
}) {
  const save = useSaveClient(client?.id)
  const org = useOrganization()
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
      postal_code: client?.postal_code || '',
      emergency_contact_name: client?.emergency_contact_name || '',
      emergency_contact_relationship:
        client?.emergency_contact_relationship || '',
      emergency_contact_phone: client?.emergency_contact_phone || '',
      care_arrangement:
        client?.care_arrangement || ('self_pay' as CareArrangement),
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
        await save.mutateAsync({
          ...value,
          ...Object.fromEntries(
            optionalKeys.map((key) => [key, value[key].trim() || null]),
          ),
        })
        onSuccess()
      } catch (err) {
        setError(errorMessage(err))
      }
    },
  })
  const [defaulted, setDefaulted] = useState(false)
  if (org.data && !client && !defaulted) {
    setDefaulted(true)
    form.setFieldValue(
      'care_arrangement',
      org.data.uses_authorizations ? 'funded' : 'self_pay',
    )
  }
  const dirty = useStore(form.store, (s) => s.isDirty)
  useUnsavedChanges(dirty && !save.isPending && !save.isSuccess)
  useEffect(() => {
    onDirtyChange?.(dirty)
  }, [dirty, onDirtyChange])
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
                      : name === 'care_arrangement'
                        ? org.data?.uses_authorizations ||
                          client?.care_arrangement === 'funded'
                          ? ['self_pay', 'funded']
                          : ['self_pay']
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
                          onBlur={field.handleBlur}
                          required={name in schema.shape && name !== 'email'}
                        />
                      )}
                      {name === 'notes' && (
                        <span className="cw-muted">
                          Agency-only notes; not shown to workers.
                        </span>
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
