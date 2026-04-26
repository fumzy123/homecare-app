import { useForm } from '@tanstack/react-form'
import { z } from 'zod'
import { useState } from 'react'
import { invitationsApi, type InvitationRole } from '@/features/invitations/api'
import { Kicker } from '@/shared/components/ui'

const schema = z.object({
  email: z.string().email('Invalid email address'),
  role:  z.enum(['agency_admin', 'home_support_worker']),
})

const labelClass = 'block font-mono text-[9px] tracking-[0.1em] uppercase text-ink-soft mb-1'
const inputClass = 'w-full bg-cream border border-ink px-3 py-2.5 font-mono text-[11px] text-ink focus:outline-none focus:ring-1 focus:ring-ink'

interface InviteModalProps {
  onClose: () => void
  onSuccess: () => void
}

export function InviteModal({ onClose, onSuccess }: InviteModalProps) {
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm({
    defaultValues: { email: '', role: 'home_support_worker' as InvitationRole },
    onSubmit: async ({ value }) => {
      setServerError(null)
      try {
        await invitationsApi.sendInvitation(value)
        onSuccess()
        onClose()
      } catch (err: unknown) {
        setServerError(err instanceof Error ? err.message : 'Something went wrong')
      }
    },
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30">
      <div className="w-full max-w-sm bg-paper border border-ink">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-ink">
          <Kicker>Invite member</Kicker>
          <button onClick={onClose} className="font-mono text-[18px] text-ink-soft hover:text-ink leading-none">×</button>
        </div>

        {/* Form */}
        <form
          onSubmit={(e) => { e.preventDefault(); form.handleSubmit() }}
          className="px-6 py-6 flex flex-col gap-5"
        >
          <form.Field name="email" validators={{ onChange: ({ value }) => {
            const r = schema.shape.email.safeParse(value)
            return r.success ? undefined : r.error.issues[0].message
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

          <form.Field name="role">
            {(field) => (
              <div>
                <label className={labelClass}>Role</label>
                <select
                  className={`${inputClass} appearance-none`}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value as InvitationRole)}
                >
                  <option value="home_support_worker">Worker</option>
                  <option value="agency_admin">Admin</option>
                </select>
              </div>
            )}
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
            <form.Subscribe selector={(s) => s.isSubmitting}>
              {(isSubmitting) => (
                <button
                  type="submit"
                  disabled={isSubmitting}
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
