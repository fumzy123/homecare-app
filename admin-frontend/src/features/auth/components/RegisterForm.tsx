import { useForm } from '@tanstack/react-form'
import { z } from 'zod'
import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { authApi } from '@/features/auth/api'
import { supabase } from '@/shared/lib/supabase'
import { useAuthStore } from '@/shared/stores/auth'

const schema = z.object({
  organization_name: z.string().min(2, 'Organization name is required'),
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})


export function RegisterForm() {
  const navigate = useNavigate()
  const [serverError, setServerError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const form = useForm({
    defaultValues: {
      organization_name: '',
      first_name: '',
      last_name: '',
      email: '',
      password: '',
    },
    onSubmit: async ({ value }) => {
      setServerError(null)
      try {
        // Step 1 — create Supabase auth user
        await authApi.signUp(value.email, value.password)

        // Step 2 — sign in immediately to get JWT
        await authApi.signIn(value.email, value.password)

        // Step 3 — create org in our database (JWT is now in Axios interceptor)
        await authApi.registerOrganization({
          organization_name: value.organization_name,
          first_name: value.first_name,
          last_name: value.last_name,
        })

        setSuccess(true)
      } catch (err: unknown) {
        // Clean up any partial Supabase session so the user isn't
        // silently "logged in" with no backend org profile.
        useAuthStore.getState().clearAuth()
        await supabase.auth.signOut()
        const message = err instanceof Error ? err.message : 'Something went wrong'
        setServerError(message)
      }
    },
  })

  if (success) {
    return (
      <div className="text-center">
        <h2 className="text-xl font-semibold text-gray-800">Check your email</h2>
        <p className="mt-2 text-sm text-gray-500">
          We sent a verification link to your email address. Verify your email then sign in.
        </p>
        <button
          onClick={() => navigate({ to: '/login' })}
          className="mt-6 text-sm text-gray-700 underline"
        >
          Go to login
        </button>
      </div>
    )
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        form.handleSubmit()
      }}
      className="flex flex-col gap-4"
    >
      <form.Field
        name="organization_name"
        validators={{ onChange: ({ value }) => {
          const result = schema.shape.organization_name.safeParse(value)
          return result.success ? undefined : result.error.issues[0].message
        }}}
      >
        {(field) => (
          <div>
            <label className="block text-sm font-medium text-gray-700">Organization Name</label>
            <input
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
              placeholder="Sunrise Home Care"
            />
            {field.state.meta.errors[0] && (
              <p className="mt-1 text-xs text-red-500">{field.state.meta.errors[0]}</p>
            )}
          </div>
        )}
      </form.Field>

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
              placeholder="jane@sunrisehomecare.com"
            />
            {field.state.meta.errors[0] && (
              <p className="mt-1 text-xs text-red-500">{field.state.meta.errors[0]}</p>
            )}
          </div>
        )}
      </form.Field>

      <form.Field
        name="password"
        validators={{ onChange: ({ value }) => {
          const result = schema.shape.password.safeParse(value)
          return result.success ? undefined : result.error.issues[0].message
        }}}
      >
        {(field) => (
          <div>
            <label className="block text-sm font-medium text-gray-700">Password</label>
            <input
              type="password"
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
              placeholder="••••••••"
            />
            {field.state.meta.errors[0] && (
              <p className="mt-1 text-xs text-red-500">{field.state.meta.errors[0]}</p>
            )}
          </div>
        )}
      </form.Field>

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
            {isSubmitting ? 'Creating account...' : 'Create Account'}
          </button>
        )}
      </form.Subscribe>
    </form>
  )
}
