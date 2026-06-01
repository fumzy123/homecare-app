import { useForm } from '@tanstack/react-form'
import { z } from 'zod'
import { useState } from 'react'
import { invitationsApi, type InvitationRole, type EmploymentType } from '@/features/invitations/api'
import { STAFF_ROLES, ROLE_LABELS } from '@/features/invitations/constants'
import { Kicker } from '@/shared/components/ui'
import { useAuthStore } from '@/shared/stores/auth'

const schema = z.object({
  email: z.string().email('Invalid email address'),
})

const EMPLOYMENT_TYPES: { value: EmploymentType; label: string; hint: string }[] = [
  { value: 'part_time', label: 'Part-time', hint: 'Default cap: 24h/week' },
  { value: 'full_time', label: 'Full-time', hint: 'Default cap: 40h/week' },
  { value: 'casual',    label: 'Casual',    hint: 'No weekly cap' },
]

const labelClass = 'block font-mono text-[9px] tracking-[0.1em] uppercase text-ink-soft mb-1'
const inputClass = 'w-full bg-cream border border-ink px-3 py-2.5 font-mono text-[11px] text-ink focus:outline-none focus:ring-1 focus:ring-ink'

interface InviteModalProps {
  onClose: () => void
  onSuccess: () => void
  role?: InvitationRole
  showRoleSelector?: boolean
}

export function InviteModal({
  onClose,
  onSuccess,
  role = 'home_support_worker',
  showRoleSelector = false,
}: InviteModalProps) {
  const [serverError, setServerError] = useState<string | null>(null)
  const user = useAuthStore(s => s.user)

  const form = useForm({
    defaultValues: {
      email: '',
      role: showRoleSelector ? ('manager' as InvitationRole) : role,
      employment_type: 'full_time' as EmploymentType,
    },
    onSubmit: async ({ value }) => {
      setServerError(null)
      try {
        await invitationsApi.sendInvitation({
          email: value.email,
          role: value.role,
          employment_type: value.employment_type,
        })
        onSuccess()
        onClose()
      } catch (err: unknown) {
        setServerError(err instanceof Error ? err.message : 'Something went wrong')
      }
    },
  })

  const title = showRoleSelector ? 'Invite staff member' : 'Invite new worker'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30">
      <div className="w-full max-w-sm bg-paper border border-ink">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-ink">
          <Kicker>{title}</Kicker>
          <button onClick={onClose} className="font-mono text-[18px] text-ink-soft hover:text-ink leading-none">×</button>
        </div>

        {/* Form */}
        <form
          onSubmit={(e) => { e.preventDefault(); form.handleSubmit() }}
          className="px-6 py-6 flex flex-col gap-5"
        >
          {/* Role selector — only shown in team/staff context */}
          {showRoleSelector && (
            <form.Field name="role">
              {(field) => (
                <div>
                  <label className={labelClass}>Role</label>
                  <select
                    className={inputClass}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value as InvitationRole)}
                  >
                    {STAFF_ROLES.map((r) => (
                      <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                    ))}
                  </select>
                </div>
              )}
            </form.Field>
          )}

          {/* Email */}
          <form.Field name="email" validators={{ onBlur: ({ value }) => {
            const r = schema.shape.email.safeParse(value)
            if (!r.success) return r.error.issues[0].message
            if (value.toLowerCase() === user?.email?.toLowerCase()) return 'You cannot invite yourself'
            return undefined
          }}}>
            {(field) => (
              <div>
                <label className={labelClass}>Email</label>
                <input
                  type="email"
                  className={inputClass}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder="jane@example.com"
                />
                {field.state.meta.errors[0] && (
                  <p className="mt-1 font-mono text-[10px] text-orange">{field.state.meta.errors[0]}</p>
                )}
              </div>
            )}
          </form.Field>

          {/* Employment type */}
          <form.Field name="employment_type">
            {(field) => {
              const selected = EMPLOYMENT_TYPES.find((t) => t.value === field.state.value)
              return (
                <div>
                  <label className={labelClass}>Employment type</label>
                  <div className="flex">
                    {EMPLOYMENT_TYPES.map((t, i) => (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => field.handleChange(t.value)}
                        className={`flex-1 py-2 font-mono text-[10px] tracking-[0.06em] uppercase border transition-colors ${
                          field.state.value === t.value
                            ? 'bg-ink text-cream border-ink'
                            : 'border-ink text-ink-soft hover:text-ink'
                        } ${i > 0 ? '-ml-px' : ''}`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                  {selected && (
                    <p className="mt-1 font-mono text-[9px] text-muted">{selected.hint}</p>
                  )}
                </div>
              )
            }}
          </form.Field>

          {serverError && (
            <p className="font-mono text-[10px] text-orange border border-orange px-3 py-2">{serverError}</p>
          )}

          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="border border-ink px-4 py-2 font-mono text-[10px] tracking-[0.08em] uppercase text-ink-soft hover:text-ink transition-colors"
            >
              Cancel
            </button>
            <form.Subscribe selector={(s) => [s.isSubmitting, s.canSubmit] as const}>
              {([isSubmitting, canSubmit]) => (
                <button
                  type="submit"
                  disabled={isSubmitting || !canSubmit}
                  className="bg-ink text-cream px-5 py-2 font-mono text-[10px] tracking-[0.08em] uppercase hover:opacity-80 disabled:opacity-40 transition-opacity"
                >
                  {isSubmitting ? 'Sending…' : 'Send invite'}
                </button>
              )}
            </form.Subscribe>
          </div>
        </form>
      </div>
    </div>
  )
}
