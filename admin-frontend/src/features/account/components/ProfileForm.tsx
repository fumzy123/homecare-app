import { useForm } from '@tanstack/react-form'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { orgMembersApi } from '@/features/org-members/api'
import { useAuthStore } from '@/shared/stores/auth'
import { DateInput } from '@/shared/components/ui'

const labelClass = 'block font-mono text-[9px] tracking-[0.1em] uppercase text-ink-soft mb-1'
const inputClass = 'w-full bg-cream border border-ink px-3 py-2.5 font-mono text-[12px] text-ink focus:outline-none focus:ring-1 focus:ring-ink'

export function ProfileForm() {
  const { user, updateUser } = useAuthStore()
  const [saved, setSaved]             = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const { data: member } = useQuery({
    queryKey: ['org-member-self', user?.id],
    queryFn:  () => orgMembersApi.getOrgMember(user!.id),
    enabled:  !!user?.id,
  })

  const form = useForm({
    defaultValues: {
      first_name:    user?.firstName    ?? '',
      last_name:     user?.lastName     ?? '',
      email:         user?.email        ?? '',
      phone_number:  member?.phone_number  ?? '',
      gender:        member?.gender        ?? '',
      date_of_birth: member?.date_of_birth ?? '',
    },
    onSubmit: async ({ value }) => {
      if (!user) return
      setServerError(null)
      try {
        const updated = await orgMembersApi.updateSelf(user.id, {
          first_name:    value.first_name   || undefined,
          last_name:     value.last_name    || undefined,
          email:         value.email        || undefined,
          phone_number:  value.phone_number || undefined,
          gender:        value.gender       || undefined,
          date_of_birth: value.date_of_birth || undefined,
        })
        updateUser({ firstName: updated.first_name, lastName: updated.last_name, email: updated.email })
        setSaved(true)
        setTimeout(() => setSaved(false), 2500)
      } catch (err: unknown) {
        setServerError(err instanceof Error ? err.message : 'Something went wrong')
      }
    },
  })

  return (
    <div className="border border-ink bg-paper">
      <div className="px-6 py-4 border-b border-ink">
        <p className="font-mono text-[9px] tracking-[0.12em] uppercase text-ink-soft">A · Personal info</p>
        <h3 className="font-serif text-[22px] leading-none font-medium mt-1">Who you are at work</h3>
      </div>

      <form
        className="px-6 py-6 flex flex-col gap-5"
        onSubmit={(e) => { e.preventDefault(); form.handleSubmit() }}
      >
        {/* Row 1: First name · Last name · Gender */}
        <div className="grid grid-cols-3 gap-4">
          <form.Field name="first_name" validators={{ onChange: ({ value }) => {
            return value.trim() ? undefined : 'Required'
          }}}>
            {(field) => (
              <div>
                <label className={labelClass}>First name</label>
                <input className={inputClass} value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)} onBlur={field.handleBlur} />
                {field.state.meta.errors[0] && (
                  <p className="mt-1 font-mono text-[10px] text-orange">{field.state.meta.errors[0] as string}</p>
                )}
              </div>
            )}
          </form.Field>

          <form.Field name="last_name" validators={{ onChange: ({ value }) => {
            return value.trim() ? undefined : 'Required'
          }}}>
            {(field) => (
              <div>
                <label className={labelClass}>Last name</label>
                <input className={inputClass} value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)} onBlur={field.handleBlur} />
                {field.state.meta.errors[0] && (
                  <p className="mt-1 font-mono text-[10px] text-orange">{field.state.meta.errors[0] as string}</p>
                )}
              </div>
            )}
          </form.Field>

          <form.Field name="gender">
            {(field) => (
              <div>
                <label className={labelClass}>Gender</label>
                <select className={`${inputClass} appearance-none`} value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}>
                  <option value="">Select</option>
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                  <option value="non_binary">Non-binary</option>
                  <option value="prefer_not_to_say">Prefer not to say</option>
                </select>
              </div>
            )}
          </form.Field>
        </div>

        {/* Row 2: Email · Date of birth */}
        <div className="grid grid-cols-3 gap-4">
          <form.Field name="email" validators={{ onChange: ({ value }) => {
            return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? undefined : 'Invalid email'
          }}}>
            {(field) => (
              <div className="col-span-2">
                <label className={labelClass}>Email</label>
                <input type="email" className={inputClass} value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)} onBlur={field.handleBlur} />
                {field.state.meta.errors[0] && (
                  <p className="mt-1 font-mono text-[10px] text-orange">{field.state.meta.errors[0]}</p>
                )}
              </div>
            )}
          </form.Field>

          <form.Field name="date_of_birth">
            {(field) => (
              <div>
                <label className={labelClass}>Date of birth</label>
                <DateInput value={field.state.value} onChange={(v) => field.handleChange(v)} className="w-full" />
              </div>
            )}
          </form.Field>
        </div>

        {/* Row 3: Phone number · Role (read-only) */}
        <div className="grid grid-cols-3 gap-4">
          <form.Field name="phone_number">
            {(field) => (
              <div className="col-span-2">
                <label className={labelClass}>Phone number</label>
                <input className={inputClass} value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)} placeholder="+1 (000) 000-0000" />
              </div>
            )}
          </form.Field>

          <div>
            <label className={labelClass}>Role</label>
            <input className={`${inputClass} bg-cream-2 text-ink-soft cursor-not-allowed`}
              value={user?.role ?? '—'} disabled />
          </div>
        </div>

        {serverError && (
          <p className="font-mono text-[10px] text-orange border border-orange px-3 py-2">{serverError}</p>
        )}

        <div className="flex items-center justify-end gap-4 pt-1">
          {saved && <span className="font-mono text-[10px] text-mint tracking-wide uppercase">Saved ✓</span>}
          <form.Subscribe selector={(s) => s.isSubmitting}>
            {(isSubmitting) => (
              <button type="submit" disabled={isSubmitting}
                className="bg-ink text-cream px-5 py-2 font-mono text-[10px] tracking-[0.08em] uppercase hover:opacity-80 disabled:opacity-40 transition-opacity">
                {isSubmitting ? 'Saving…' : 'Save changes'}
              </button>
            )}
          </form.Subscribe>
        </div>
      </form>
    </div>
  )
}
