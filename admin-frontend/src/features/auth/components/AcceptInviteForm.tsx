import { useForm } from '@tanstack/react-form'
import { z } from 'zod'
import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { authApi } from '@/features/auth/api'

const schema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
})


export function AcceptInviteForm() {
  const navigate = useNavigate()
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm({
    defaultValues: { first_name: '', last_name: '' },
    onSubmit: async ({ value }) => {
      setServerError(null)
      try {
        // JWT is already in Zustand from onAuthStateChange firing
        // when Supabase processed the invite link
        await authApi.acceptInvite(value)
        navigate({ to: '/dashboard' })
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Something went wrong'
        setServerError(message)
      }
    },
  })

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        form.handleSubmit()
      }}
      className="flex flex-col gap-4"
    >
      <div className="flex gap-3">
        <form.Field
          name="first_name"
          validators={{ onChange: ({ value }) => {
            const result = schema.shape.first_name.safeParse(value)
            return result.success ? undefined : result.error.issues[0].message
          }}}
        >
          {(field) => (
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700">First Name</label>
              <input
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                placeholder="Jane"
              />
              {field.state.meta.errors[0] && (
                <p className="mt-1 text-xs text-red-500">{field.state.meta.errors[0]}</p>
              )}
            </div>
          )}
        </form.Field>

        <form.Field
          name="last_name"
          validators={{ onChange: ({ value }) => {
            const result = schema.shape.last_name.safeParse(value)
            return result.success ? undefined : result.error.issues[0].message
          }}}
        >
          {(field) => (
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700">Last Name</label>
              <input
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                placeholder="Doe"
              />
              {field.state.meta.errors[0] && (
                <p className="mt-1 text-xs text-red-500">{field.state.meta.errors[0]}</p>
              )}
            </div>
          )}
        </form.Field>
      </div>

      {serverError && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{serverError}</p>
      )}

      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(isSubmitting) => (
          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-2 w-full rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Setting up account...' : 'Complete Setup'}
          </button>
        )}
      </form.Subscribe>
    </form>
  )
}
