import { createFileRoute } from '@tanstack/react-router'
import { useForm } from '@tanstack/react-form'
import { useState } from 'react'
import { z } from 'zod'
import { workersApi } from '@/features/workers/api'
import { useAuthStore } from '@/shared/stores/auth'

export const Route = createFileRoute('/_protected/account/')({
  component: AccountPage,
})

const schema = z.object({
  first_name: z.string().min(1, 'Required'),
  last_name: z.string().min(1, 'Required'),
  email: z.string().email('Invalid email'),
})

function validate<T>(shape: z.ZodType<T>, value: T) {
  const r = shape.safeParse(value)
  return r.success ? undefined : r.error.issues[0].message
}

function FieldError({ error }: { error: unknown }) {
  if (!error) return null
  return <p className="mt-1 text-xs text-red-500">{error as string}</p>
}

const inputClass =
  'mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400'
const labelClass = 'block text-sm font-medium text-gray-700'

function AccountPage() {
  const { user, updateUser } = useAuthStore()
  const [saved, setSaved] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm({
    defaultValues: {
      first_name: user?.firstName ?? '',
      last_name: user?.lastName ?? '',
      email: user?.email ?? '',
    },
    onSubmit: async ({ value }) => {
      if (!user) return
      setServerError(null)
      try {
        const updated = await workersApi.updateMember(user.id, {
          first_name: value.first_name,
          last_name: value.last_name,
          email: value.email,
        })
        updateUser({
          firstName: updated.first_name,
          lastName: updated.last_name,
          email: updated.email,
        })
        setSaved(true)
        setTimeout(() => setSaved(false), 2500)
      } catch (err: unknown) {
        setServerError(err instanceof Error ? err.message : 'Something went wrong')
      }
    },
  })

  return (
    <div className="p-8 max-w-xl">
      <h1 className="text-2xl font-semibold text-gray-900">Account</h1>
      <p className="mt-1 text-sm text-gray-500">Update your name and email address.</p>

      <form
        className="mt-8 flex flex-col gap-5"
        onSubmit={(e) => { e.preventDefault(); form.handleSubmit() }}
      >
        <div className="flex gap-4">
          <form.Field
            name="first_name"
            validators={{ onChange: ({ value }) => validate(schema.shape.first_name, value) }}
          >
            {(field) => (
              <div className="flex-1">
                <label className={labelClass}>First Name</label>
                <input
                  className={inputClass}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
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
                <label className={labelClass}>Last Name</label>
                <input
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

        <form.Field
          name="email"
          validators={{ onChange: ({ value }) => validate(schema.shape.email, value) }}
        >
          {(field) => (
            <div>
              <label className={labelClass}>Email</label>
              <input
                type="email"
                className={inputClass}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
              />
              <FieldError error={field.state.meta.errors[0]} />
            </div>
          )}
        </form.Field>

        {serverError && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{serverError}</p>
        )}

        <div className="flex items-center gap-3">
          <form.Subscribe selector={(s) => s.isSubmitting}>
            {(isSubmitting) => (
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
              >
                {isSubmitting ? 'Saving…' : 'Save Changes'}
              </button>
            )}
          </form.Subscribe>
          {saved && <p className="text-sm text-green-600">Saved</p>}
        </div>
      </form>
    </div>
  )
}
