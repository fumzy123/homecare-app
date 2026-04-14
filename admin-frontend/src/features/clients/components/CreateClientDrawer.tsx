import { useForm } from '@tanstack/react-form'
import { useState } from 'react'
import { X } from 'lucide-react'
import { z } from 'zod'
import { clientsApi, type ClientCreatePayload, type ClientStatus, type ServiceType } from '@/features/clients/api'

const schema = z.object({
  first_name: z.string().min(1, 'Required'),
  last_name: z.string().min(1, 'Required'),
  date_of_birth: z.string().min(1, 'Required'),
  gender: z.string().optional(),
  phone_number: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  street: z.string().min(1, 'Required'),
  city: z.string().min(1, 'Required'),
  province: z.string().min(1, 'Required'),
  postal_code: z.string().min(1, 'Required'),
  service_type: z.enum(['personal_care', 'companionship', 'respite', 'nursing']),
  care_start_date: z.string().min(1, 'Required'),
  care_end_date: z.string().optional(),
  medical_conditions: z.string().optional(),
  allergies: z.string().optional(),
  medications: z.string().optional(),
  special_instructions: z.string().optional(),
  emergency_contact_name: z.string().min(1, 'Required'),
  emergency_contact_phone: z.string().min(1, 'Required'),
  emergency_contact_relationship: z.string().min(1, 'Required'),
  status: z.enum(['active', 'on_hold', 'discharged']),
  funding_source: z.string().optional(),
  notes: z.string().optional(),
})

interface CreateClientDrawerProps {
  onClose: () => void
  onSuccess: () => void
}

function validate<T>(shape: z.ZodType<T>, value: T) {
  const result = shape.safeParse(value)
  return result.success ? undefined : result.error.issues[0].message
}

function FieldError({ error }: { error: unknown }) {
  if (!error) return null
  return <p className="mt-1 text-xs text-red-500">{error as string}</p>
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3 mt-6 first:mt-0">
      {children}
    </h3>
  )
}

const inputClass =
  'mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400'
const labelClass = 'block text-sm font-medium text-gray-700'

export function CreateClientDrawer({ onClose, onSuccess }: CreateClientDrawerProps) {
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm({
    defaultValues: {
      first_name: '',
      last_name: '',
      date_of_birth: '',
      gender: '',
      phone_number: '',
      email: '',
      street: '',
      city: '',
      province: '',
      postal_code: '',
      service_type: 'personal_care' as ServiceType,
      care_start_date: '',
      care_end_date: '',
      medical_conditions: '',
      allergies: '',
      medications: '',
      special_instructions: '',
      emergency_contact_name: '',
      emergency_contact_phone: '',
      emergency_contact_relationship: '',
      status: 'active' as ClientStatus,
      funding_source: '',
      notes: '',
    },
    onSubmit: async ({ value }) => {
      setServerError(null)
      const payload: ClientCreatePayload = {
        first_name: value.first_name,
        last_name: value.last_name,
        date_of_birth: value.date_of_birth,
        gender: value.gender || undefined,
        phone_number: value.phone_number || undefined,
        email: value.email || undefined,
        street: value.street,
        city: value.city,
        province: value.province,
        postal_code: value.postal_code,
        service_type: value.service_type,
        care_start_date: value.care_start_date,
        care_end_date: value.care_end_date || undefined,
        medical_conditions: value.medical_conditions || undefined,
        allergies: value.allergies || undefined,
        medications: value.medications || undefined,
        special_instructions: value.special_instructions || undefined,
        emergency_contact_name: value.emergency_contact_name,
        emergency_contact_phone: value.emergency_contact_phone,
        emergency_contact_relationship: value.emergency_contact_relationship,
        status: value.status,
        funding_source: value.funding_source || undefined,
        notes: value.notes || undefined,
      }
      try {
        await clientsApi.createClient(payload)
        onSuccess()
        onClose()
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Something went wrong'
        setServerError(message)
      }
    },
  })

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/20"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900">New Client</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable form body */}
        <form
          className="flex-1 overflow-y-auto px-6 py-5"
          onSubmit={(e) => {
            e.preventDefault()
            form.handleSubmit()
          }}
        >
          {/* ── Personal Info ── */}
          <SectionHeading>Personal Info</SectionHeading>

          <div className="flex gap-3">
            <form.Field
              name="first_name"
              validators={{ onChange: ({ value }) => validate(schema.shape.first_name, value) }}
            >
              {(field) => (
                <div className="flex-1">
                  <label className={labelClass}>First Name *</label>
                  <input
                    className={inputClass}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    placeholder="Jane"
                  />
                  <FieldError error={field.state.meta.errors[0]} />
                </div>
              )}
            </form.Field>

            <form.Field
              name="last_name"
              validators={{ onChange: ({ value }) => validate(schema.shape.last_name, value) }}
            >
              {(field) => (
                <div className="flex-1">
                  <label className={labelClass}>Last Name *</label>
                  <input
                    className={inputClass}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    placeholder="Doe"
                  />
                  <FieldError error={field.state.meta.errors[0]} />
                </div>
              )}
            </form.Field>
          </div>

          <div className="mt-3 flex gap-3">
            <form.Field
              name="date_of_birth"
              validators={{ onChange: ({ value }) => validate(schema.shape.date_of_birth, value) }}
            >
              {(field) => (
                <div className="flex-1">
                  <label className={labelClass}>Date of Birth *</label>
                  <input
                    type="date"
                    className={inputClass}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                  />
                  <FieldError error={field.state.meta.errors[0]} />
                </div>
              )}
            </form.Field>

            <form.Field name="gender">
              {(field) => (
                <div className="flex-1">
                  <label className={labelClass}>Gender</label>
                  <select
                    className={inputClass}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                  >
                    <option value="">Select…</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="non_binary">Non-binary</option>
                    <option value="prefer_not_to_say">Prefer not to say</option>
                  </select>
                </div>
              )}
            </form.Field>
          </div>

          <div className="mt-3 flex gap-3">
            <form.Field name="phone_number">
              {(field) => (
                <div className="flex-1">
                  <label className={labelClass}>Phone</label>
                  <input
                    className={inputClass}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="+1 (555) 000-0000"
                  />
                </div>
              )}
            </form.Field>

            <form.Field
              name="email"
              validators={{ onChange: ({ value }) => validate(schema.shape.email, value) }}
            >
              {(field) => (
                <div className="flex-1">
                  <label className={labelClass}>Email</label>
                  <input
                    type="email"
                    className={inputClass}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="jane@example.com"
                  />
                  <FieldError error={field.state.meta.errors[0]} />
                </div>
              )}
            </form.Field>
          </div>

          {/* ── Address ── */}
          <SectionHeading>Address</SectionHeading>

          <form.Field
            name="street"
            validators={{ onChange: ({ value }) => validate(schema.shape.street, value) }}
          >
            {(field) => (
              <div>
                <label className={labelClass}>Street *</label>
                <input
                  className={inputClass}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder="123 Main St"
                />
                <FieldError error={field.state.meta.errors[0]} />
              </div>
            )}
          </form.Field>

          <div className="mt-3 flex gap-3">
            <form.Field
              name="city"
              validators={{ onChange: ({ value }) => validate(schema.shape.city, value) }}
            >
              {(field) => (
                <div className="flex-1">
                  <label className={labelClass}>City *</label>
                  <input
                    className={inputClass}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    placeholder="Vancouver"
                  />
                  <FieldError error={field.state.meta.errors[0]} />
                </div>
              )}
            </form.Field>

            <form.Field
              name="province"
              validators={{ onChange: ({ value }) => validate(schema.shape.province, value) }}
            >
              {(field) => (
                <div className="w-28">
                  <label className={labelClass}>Province *</label>
                  <select
                    className={inputClass}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                  >
                    <option value="">—</option>
                    {['AB','BC','MB','NB','NL','NS','NT','NU','ON','PE','QC','SK','YT'].map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                  <FieldError error={field.state.meta.errors[0]} />
                </div>
              )}
            </form.Field>

            <form.Field
              name="postal_code"
              validators={{ onChange: ({ value }) => validate(schema.shape.postal_code, value) }}
            >
              {(field) => (
                <div className="w-28">
                  <label className={labelClass}>Postal Code *</label>
                  <input
                    className={inputClass}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    placeholder="V6B 1A1"
                  />
                  <FieldError error={field.state.meta.errors[0]} />
                </div>
              )}
            </form.Field>
          </div>

          {/* ── Care Details ── */}
          <SectionHeading>Care Details</SectionHeading>

          <div className="flex gap-3">
            <form.Field
              name="service_type"
              validators={{ onChange: ({ value }) => validate(schema.shape.service_type, value) }}
            >
              {(field) => (
                <div className="flex-1">
                  <label className={labelClass}>Service Type *</label>
                  <select
                    className={inputClass}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value as ServiceType)}
                    onBlur={field.handleBlur}
                  >
                    <option value="personal_care">Personal Care</option>
                    <option value="companionship">Companionship</option>
                    <option value="respite">Respite</option>
                    <option value="nursing">Nursing</option>
                  </select>
                  <FieldError error={field.state.meta.errors[0]} />
                </div>
              )}
            </form.Field>

            <form.Field
              name="care_start_date"
              validators={{ onChange: ({ value }) => validate(schema.shape.care_start_date, value) }}
            >
              {(field) => (
                <div className="flex-1">
                  <label className={labelClass}>Care Start Date *</label>
                  <input
                    type="date"
                    className={inputClass}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                  />
                  <FieldError error={field.state.meta.errors[0]} />
                </div>
              )}
            </form.Field>
          </div>

          <div className="mt-3">
            <form.Field name="care_end_date">
              {(field) => (
                <div className="w-1/2 pr-1.5">
                  <label className={labelClass}>Care End Date</label>
                  <input
                    type="date"
                    className={inputClass}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </div>
              )}
            </form.Field>
          </div>

          {(['medical_conditions', 'allergies', 'medications', 'special_instructions'] as const).map((name) => (
            <form.Field key={name} name={name}>
              {(field) => (
                <div className="mt-3">
                  <label className={labelClass}>
                    {name === 'medical_conditions' ? 'Medical Conditions'
                      : name === 'allergies' ? 'Allergies'
                      : name === 'medications' ? 'Medications'
                      : 'Special Instructions'}
                  </label>
                  <textarea
                    className={`${inputClass} resize-none`}
                    rows={2}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="Optional"
                  />
                </div>
              )}
            </form.Field>
          ))}

          {/* ── Emergency Contact ── */}
          <SectionHeading>Emergency Contact</SectionHeading>

          <form.Field
            name="emergency_contact_name"
            validators={{ onChange: ({ value }) => validate(schema.shape.emergency_contact_name, value) }}
          >
            {(field) => (
              <div>
                <label className={labelClass}>Name *</label>
                <input
                  className={inputClass}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder="John Doe"
                />
                <FieldError error={field.state.meta.errors[0]} />
              </div>
            )}
          </form.Field>

          <div className="mt-3 flex gap-3">
            <form.Field
              name="emergency_contact_phone"
              validators={{ onChange: ({ value }) => validate(schema.shape.emergency_contact_phone, value) }}
            >
              {(field) => (
                <div className="flex-1">
                  <label className={labelClass}>Phone *</label>
                  <input
                    className={inputClass}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    placeholder="+1 (555) 000-0000"
                  />
                  <FieldError error={field.state.meta.errors[0]} />
                </div>
              )}
            </form.Field>

            <form.Field
              name="emergency_contact_relationship"
              validators={{ onChange: ({ value }) => validate(schema.shape.emergency_contact_relationship, value) }}
            >
              {(field) => (
                <div className="flex-1">
                  <label className={labelClass}>Relationship *</label>
                  <input
                    className={inputClass}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    placeholder="Spouse, Parent…"
                  />
                  <FieldError error={field.state.meta.errors[0]} />
                </div>
              )}
            </form.Field>
          </div>

          {/* ── Administrative ── */}
          <SectionHeading>Administrative</SectionHeading>

          <div className="flex gap-3">
            <form.Field name="status">
              {(field) => (
                <div className="flex-1">
                  <label className={labelClass}>Status</label>
                  <select
                    className={inputClass}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value as ClientStatus)}
                  >
                    <option value="active">Active</option>
                    <option value="on_hold">On Hold</option>
                    <option value="discharged">Discharged</option>
                  </select>
                </div>
              )}
            </form.Field>

            <form.Field name="funding_source">
              {(field) => (
                <div className="flex-1">
                  <label className={labelClass}>Funding Source</label>
                  <input
                    className={inputClass}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="e.g. CLBC, Private"
                  />
                </div>
              )}
            </form.Field>
          </div>

          <form.Field name="notes">
            {(field) => (
              <div className="mt-3">
                <label className={labelClass}>Notes</label>
                <textarea
                  className={`${inputClass} resize-none`}
                  rows={3}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="Any additional notes…"
                />
              </div>
            )}
          </form.Field>

          {serverError && (
            <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{serverError}</p>
          )}

          {/* Bottom padding so last field isn't hidden under sticky footer */}
          <div className="h-4" />
        </form>

        {/* Sticky footer */}
        <div className="border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <button
                type="button"
                onClick={() => form.handleSubmit()}
                disabled={isSubmitting}
                className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
              >
                {isSubmitting ? 'Saving…' : 'Create Client'}
              </button>
            )}
          </form.Subscribe>
        </div>
      </div>
    </>
  )
}
