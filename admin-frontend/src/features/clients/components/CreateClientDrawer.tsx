import { useForm } from '@tanstack/react-form'
import { useState } from 'react'
import { z } from 'zod'
import { clientsApi, type ClientCreatePayload, type ClientStatus, type ServiceType } from '@/features/clients/api'
import { Kicker } from '@/shared/components/ui'

const schema = z.object({
  first_name: z.string().min(1, 'Required'),
  last_name: z.string().min(1, 'Required'),
  date_of_birth: z.string().min(1, 'Required'),
  street: z.string().min(1, 'Required'),
  city: z.string().min(1, 'Required'),
  province: z.string().min(1, 'Required'),
  postal_code: z.string().min(1, 'Required'),
  service_type: z.enum(['personal_care', 'companionship', 'respite', 'nursing']),
  care_start_date: z.string().min(1, 'Required'),
  emergency_contact_name: z.string().min(1, 'Required'),
  emergency_contact_phone: z.string().min(1, 'Required'),
  emergency_contact_relationship: z.string().min(1, 'Required'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
})

interface CreateClientDrawerProps {
  onClose: () => void
  onSuccess: () => void
}

function FieldError({ error }: { error: unknown }) {
  if (!error) return null
  return <p className="mt-1 font-mono text-[10px] text-orange">{error as string}</p>
}

const labelClass  = 'block font-mono text-[9px] tracking-[0.1em] uppercase text-ink-soft mb-1'
const inputClass  = 'w-full bg-cream border border-ink px-3 py-2 font-mono text-[11px] text-ink focus:outline-none focus:ring-1 focus:ring-ink'
const selectClass = `${inputClass} appearance-none`

const PROVINCES = ['AB','BC','MB','NB','NL','NS','NT','NU','ON','PE','QC','SK','YT']

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[9px] tracking-[0.12em] uppercase text-ink-soft border-t border-dashed border-line-soft pt-5 mb-4">
      {children as string}
    </p>
  )
}

export function CreateClientDrawer({ onClose, onSuccess }: CreateClientDrawerProps) {
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm({
    defaultValues: {
      first_name: '', last_name: '', date_of_birth: '', gender: '',
      phone_number: '', email: '', street: '', city: '', province: '',
      postal_code: '', service_type: 'personal_care' as ServiceType,
      care_start_date: '', care_end_date: '', medical_conditions: '',
      allergies: '', medications: '', special_instructions: '',
      emergency_contact_name: '', emergency_contact_phone: '',
      emergency_contact_relationship: '', status: 'active' as ClientStatus,
      funding_source: '', notes: '',
    },
    onSubmit: async ({ value }) => {
      setServerError(null)
      const payload: ClientCreatePayload = {
        first_name: value.first_name, last_name: value.last_name,
        date_of_birth: value.date_of_birth,
        gender: value.gender || undefined,
        phone_number: value.phone_number || undefined,
        email: value.email || undefined,
        street: value.street, city: value.city,
        province: value.province, postal_code: value.postal_code,
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
        onSuccess(); onClose()
      } catch (err: unknown) {
        setServerError(err instanceof Error ? err.message : 'Something went wrong')
      }
    },
  })

  return (
    <>
      <div className="fixed inset-0 z-40 bg-ink/20" onClick={onClose} />

      <div className="fixed inset-y-0 right-0 z-50 flex w-[480px] flex-col bg-paper border-l border-ink">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-ink">
          <Kicker>New Client</Kicker>
          <button onClick={onClose} className="font-mono text-[18px] text-ink-soft hover:text-ink leading-none">×</button>
        </div>

        {/* Form body */}
        <form className="flex-1 overflow-y-auto px-6 py-6 space-y-4"
          onSubmit={(e) => { e.preventDefault(); form.handleSubmit() }}>

          {/* Personal Info */}
          <div className="grid grid-cols-2 gap-3">
            <form.Field name="first_name" validators={{ onChange: ({ value }) => { const r = schema.shape.first_name.safeParse(value); return r.success ? undefined : r.error.issues[0].message }}}>
              {(field) => (<div><label className={labelClass}>First Name <span className="text-orange">*</span></label><input className={inputClass} value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} onBlur={field.handleBlur} placeholder="Jane" /><FieldError error={field.state.meta.errors[0]} /></div>)}
            </form.Field>
            <form.Field name="last_name" validators={{ onChange: ({ value }) => { const r = schema.shape.last_name.safeParse(value); return r.success ? undefined : r.error.issues[0].message }}}>
              {(field) => (<div><label className={labelClass}>Last Name <span className="text-orange">*</span></label><input className={inputClass} value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} onBlur={field.handleBlur} placeholder="Doe" /><FieldError error={field.state.meta.errors[0]} /></div>)}
            </form.Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <form.Field name="date_of_birth" validators={{ onChange: ({ value }) => { const r = schema.shape.date_of_birth.safeParse(value); return r.success ? undefined : r.error.issues[0].message }}}>
              {(field) => (<div><label className={labelClass}>Date of Birth <span className="text-orange">*</span></label><input type="date" className={inputClass} value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} onBlur={field.handleBlur} /><FieldError error={field.state.meta.errors[0]} /></div>)}
            </form.Field>
            <form.Field name="gender">
              {(field) => (<div><label className={labelClass}>Gender</label><select className={selectClass} value={field.state.value} onChange={(e) => field.handleChange(e.target.value)}><option value="">Select…</option><option value="male">Male</option><option value="female">Female</option><option value="non_binary">Non-binary</option><option value="prefer_not_to_say">Prefer not to say</option></select></div>)}
            </form.Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <form.Field name="phone_number">
              {(field) => (<div><label className={labelClass}>Phone</label><input className={inputClass} value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} placeholder="+1 (555) 000-0000" /></div>)}
            </form.Field>
            <form.Field name="email" validators={{ onChange: ({ value }) => { if (!value) return undefined; const r = schema.shape.email.safeParse(value); return r.success ? undefined : r.error.issues[0].message }}}>
              {(field) => (<div><label className={labelClass}>Email</label><input type="email" className={inputClass} value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} placeholder="jane@example.com" /><FieldError error={field.state.meta.errors[0]} /></div>)}
            </form.Field>
          </div>

          {/* Address */}
          <SectionLabel>Address</SectionLabel>

          <form.Field name="street" validators={{ onChange: ({ value }) => { const r = schema.shape.street.safeParse(value); return r.success ? undefined : r.error.issues[0].message }}}>
            {(field) => (<div><label className={labelClass}>Street <span className="text-orange">*</span></label><input className={inputClass} value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} onBlur={field.handleBlur} placeholder="123 Main St" /><FieldError error={field.state.meta.errors[0]} /></div>)}
          </form.Field>

          <div className="grid grid-cols-[1fr_80px_90px] gap-3">
            <form.Field name="city" validators={{ onChange: ({ value }) => { const r = schema.shape.city.safeParse(value); return r.success ? undefined : r.error.issues[0].message }}}>
              {(field) => (<div><label className={labelClass}>City <span className="text-orange">*</span></label><input className={inputClass} value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} onBlur={field.handleBlur} placeholder="Vancouver" /><FieldError error={field.state.meta.errors[0]} /></div>)}
            </form.Field>
            <form.Field name="province" validators={{ onChange: ({ value }) => { const r = schema.shape.province.safeParse(value); return r.success ? undefined : r.error.issues[0].message }}}>
              {(field) => (<div><label className={labelClass}>Province <span className="text-orange">*</span></label><select className={selectClass} value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} onBlur={field.handleBlur}><option value="">—</option>{PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}</select><FieldError error={field.state.meta.errors[0]} /></div>)}
            </form.Field>
            <form.Field name="postal_code" validators={{ onChange: ({ value }) => { const r = schema.shape.postal_code.safeParse(value); return r.success ? undefined : r.error.issues[0].message }}}>
              {(field) => (<div><label className={labelClass}>Postal <span className="text-orange">*</span></label><input className={inputClass} value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} onBlur={field.handleBlur} placeholder="V6B 1A1" /><FieldError error={field.state.meta.errors[0]} /></div>)}
            </form.Field>
          </div>

          {/* Care Details */}
          <SectionLabel>Care details</SectionLabel>

          <div className="grid grid-cols-2 gap-3">
            <form.Field name="service_type" validators={{ onChange: ({ value }) => { const r = schema.shape.service_type.safeParse(value); return r.success ? undefined : r.error.issues[0].message }}}>
              {(field) => (<div><label className={labelClass}>Service Type <span className="text-orange">*</span></label><select className={selectClass} value={field.state.value} onChange={(e) => field.handleChange(e.target.value as ServiceType)} onBlur={field.handleBlur}><option value="personal_care">Personal Care</option><option value="companionship">Companionship</option><option value="respite">Respite</option><option value="nursing">Nursing</option></select><FieldError error={field.state.meta.errors[0]} /></div>)}
            </form.Field>
            <form.Field name="status">
              {(field) => (<div><label className={labelClass}>Status</label><select className={selectClass} value={field.state.value} onChange={(e) => field.handleChange(e.target.value as ClientStatus)}><option value="active">Active</option><option value="on_hold">On Hold</option><option value="discharged">Discharged</option></select></div>)}
            </form.Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <form.Field name="care_start_date" validators={{ onChange: ({ value }) => { const r = schema.shape.care_start_date.safeParse(value); return r.success ? undefined : r.error.issues[0].message }}}>
              {(field) => (<div><label className={labelClass}>Care Start <span className="text-orange">*</span></label><input type="date" className={inputClass} value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} onBlur={field.handleBlur} /><FieldError error={field.state.meta.errors[0]} /></div>)}
            </form.Field>
            <form.Field name="care_end_date">
              {(field) => (<div><label className={labelClass}>Care End</label><input type="date" className={inputClass} value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} /></div>)}
            </form.Field>
          </div>

          <form.Field name="medical_conditions">
            {(field) => (<div><label className={labelClass}>Medical Conditions</label><textarea className={`${inputClass} resize-none`} rows={2} value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} placeholder="Optional" /></div>)}
          </form.Field>

          <form.Field name="notes">
            {(field) => (<div><label className={labelClass}>Notes</label><textarea className={`${inputClass} resize-none`} rows={2} value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} placeholder="Optional" /></div>)}
          </form.Field>

          {/* Emergency Contact */}
          <SectionLabel>Emergency contact</SectionLabel>

          <form.Field name="emergency_contact_name" validators={{ onChange: ({ value }) => { const r = schema.shape.emergency_contact_name.safeParse(value); return r.success ? undefined : r.error.issues[0].message }}}>
            {(field) => (<div><label className={labelClass}>Name <span className="text-orange">*</span></label><input className={inputClass} value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} onBlur={field.handleBlur} placeholder="Full name" /><FieldError error={field.state.meta.errors[0]} /></div>)}
          </form.Field>

          <div className="grid grid-cols-2 gap-3">
            <form.Field name="emergency_contact_phone" validators={{ onChange: ({ value }) => { const r = schema.shape.emergency_contact_phone.safeParse(value); return r.success ? undefined : r.error.issues[0].message }}}>
              {(field) => (<div><label className={labelClass}>Phone <span className="text-orange">*</span></label><input className={inputClass} value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} onBlur={field.handleBlur} placeholder="+1 (555) 000-0000" /><FieldError error={field.state.meta.errors[0]} /></div>)}
            </form.Field>
            <form.Field name="emergency_contact_relationship" validators={{ onChange: ({ value }) => { const r = schema.shape.emergency_contact_relationship.safeParse(value); return r.success ? undefined : r.error.issues[0].message }}}>
              {(field) => (<div><label className={labelClass}>Relationship <span className="text-orange">*</span></label><input className={inputClass} value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} onBlur={field.handleBlur} placeholder="Spouse, Parent…" /><FieldError error={field.state.meta.errors[0]} /></div>)}
            </form.Field>
          </div>

          {serverError && (
            <p className="font-mono text-[10px] text-orange border border-orange px-3 py-2">{serverError}</p>
          )}

          <div className="h-4" />
        </form>

        {/* Footer */}
        <div className="border-t border-ink px-6 py-4 flex justify-end gap-3">
          <button type="button" onClick={onClose}
            className="border border-ink px-4 py-2 font-mono text-[10px] tracking-[0.08em] uppercase text-ink-soft hover:text-ink transition-colors">
            Cancel
          </button>
          <form.Subscribe selector={(s) => s.isSubmitting}>
            {(isSubmitting) => (
              <button type="button" onClick={() => form.handleSubmit()} disabled={isSubmitting}
                className="bg-ink text-cream px-5 py-2 font-mono text-[10px] tracking-[0.08em] uppercase hover:opacity-80 disabled:opacity-40 transition-opacity">
                {isSubmitting ? 'Saving…' : 'Create Client'}
              </button>
            )}
          </form.Subscribe>
        </div>
      </div>
    </>
  )
}
