import { useForm } from '@tanstack/react-form'
import { z } from 'zod'
import { useState } from 'react'
import { X } from 'lucide-react'
import { teamApi, type InvitationRole } from '@/features/team/api'

const schema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.enum(['agency_admin', 'home_support_worker']),
})

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
        await teamApi.sendInvitation(value)
        onSuccess()
        onClose()
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Something went wrong'
        setServerError(message)
      }
    },
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Invite team member</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            form.handleSubmit()
          }}
          className="flex flex-col gap-4"
        >
          <form.Field
            name="email"
            validators={{ onChange: ({ value }) => {
              const result = schema.shape.email.safeParse(value)
              return result.success ? undefined : result.error.issues[0].message
            }}}
          >
            {(field) => (
              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <input
                  type="email"
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder="jane@example.com"
                />
                {field.state.meta.errors[0] && (
                  <p className="mt-1 text-xs text-red-500">{field.state.meta.errors[0]}</p>
                )}
              </div>
            )}
          </form.Field>

          <form.Field name="role">
            {(field) => (
              <div>
                <label className="block text-sm font-medium text-gray-700">Role</label>
                <select
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
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
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{serverError}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(isSubmitting) => (
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
                >
                  {isSubmitting ? 'Sending...' : 'Send invite'}
                </button>
              )}
            </form.Subscribe>
          </div>
        </form>
      </div>
    </div>
  )
}
