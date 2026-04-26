import { useForm } from '@tanstack/react-form'
import { z } from 'zod'
import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { authApi } from '@/features/auth/api'
import { supabase } from '@/shared/lib/supabase'
import { useAuthStore } from '@/shared/stores/auth'

const schema = z.object({
  organization_name: z.string().min(2, 'Organization name is required'),
  first_name:        z.string().min(1, 'First name is required'),
  last_name:         z.string().min(1, 'Last name is required'),
  email:             z.string().email('Invalid email address'),
  password:          z.string().min(8, 'Password must be at least 8 characters'),
})

const labelClass = 'block font-mono text-[9px] tracking-[0.1em] uppercase text-ink-soft mb-1'
const inputClass = 'w-full bg-cream border border-ink px-3 py-2.5 font-mono text-[12px] text-ink focus:outline-none focus:ring-1 focus:ring-ink'

function FieldError({ error }: { error: unknown }) {
  if (!error) return null
  return <p className="mt-1 font-mono text-[10px] text-orange">{error as string}</p>
}

export function RegisterForm() {
  const navigate = useNavigate()
  const [serverError, setServerError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const form = useForm({
    defaultValues: { organization_name: '', first_name: '', last_name: '', email: '', password: '' },
    onSubmit: async ({ value }) => {
      setServerError(null)
      try {
        await authApi.signUp(value.email, value.password)
        await authApi.signIn(value.email, value.password)
        await authApi.registerOrganization({
          organization_name: value.organization_name,
          first_name: value.first_name,
          last_name: value.last_name,
        })
        useAuthStore.getState().updateUser({ firstName: value.first_name, lastName: value.last_name })
        setSuccess(true)
      } catch (err: unknown) {
        useAuthStore.getState().clearAuth()
        await supabase.auth.signOut()
        setServerError(err instanceof Error ? err.message : 'Something went wrong')
      }
    },
  })

  if (success) {
    return (
      <div className="text-center py-4">
        <p className="font-mono text-[9px] tracking-[0.12em] uppercase text-mint mb-3">✓ Account created</p>
        <h2 className="font-serif text-[22px] leading-none mb-3">Check your email</h2>
        <p className="font-mono text-[11px] text-ink-soft leading-relaxed mb-6">
          We sent a verification link to your address.<br />Verify then sign in.
        </p>
        <button onClick={() => navigate({ to: '/login' })}
          className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-soft hover:text-ink underline underline-offset-2 transition-colors">
          Go to sign in →
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); form.handleSubmit() }} className="flex flex-col gap-5">

      {/* Organization */}
      <form.Field name="organization_name" validators={{ onChange: ({ value }) => {
        const r = schema.shape.organization_name.safeParse(value)
        return r.success ? undefined : r.error.issues[0].message
      }}}>
        {(field) => (
          <div>
            <label className={labelClass}>Organization Name</label>
            <input className={inputClass} value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur} placeholder="Sunrise Home Care" />
            <FieldError error={field.state.meta.errors[0]} />
          </div>
        )}
      </form.Field>

      {/* Name row */}
      <div className="grid grid-cols-2 gap-3">
        <form.Field name="first_name" validators={{ onChange: ({ value }) => {
          const r = schema.shape.first_name.safeParse(value)
          return r.success ? undefined : r.error.issues[0].message
        }}}>
          {(field) => (
            <div>
              <label className={labelClass}>First Name</label>
              <input className={inputClass} value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur} placeholder="Jane" />
              <FieldError error={field.state.meta.errors[0]} />
            </div>
          )}
        </form.Field>

        <form.Field name="last_name" validators={{ onChange: ({ value }) => {
          const r = schema.shape.last_name.safeParse(value)
          return r.success ? undefined : r.error.issues[0].message
        }}}>
          {(field) => (
            <div>
              <label className={labelClass}>Last Name</label>
              <input className={inputClass} value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur} placeholder="Doe" />
              <FieldError error={field.state.meta.errors[0]} />
            </div>
          )}
        </form.Field>
      </div>

      {/* Email */}
      <form.Field name="email" validators={{ onChange: ({ value }) => {
        const r = schema.shape.email.safeParse(value)
        return r.success ? undefined : r.error.issues[0].message
      }}}>
        {(field) => (
          <div>
            <label className={labelClass}>Email</label>
            <input type="email" className={inputClass} value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur} placeholder="jane@sunrisehomecare.com" />
            <FieldError error={field.state.meta.errors[0]} />
          </div>
        )}
      </form.Field>

      {/* Password */}
      <form.Field name="password" validators={{ onChange: ({ value }) => {
        const r = schema.shape.password.safeParse(value)
        return r.success ? undefined : r.error.issues[0].message
      }}}>
        {(field) => (
          <div>
            <label className={labelClass}>Password</label>
            <input type="password" className={inputClass} value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur} placeholder="••••••••" />
            <p className="mt-1 font-mono text-[9px] text-muted">Minimum 8 characters</p>
            <FieldError error={field.state.meta.errors[0]} />
          </div>
        )}
      </form.Field>

      {serverError && (
        <p className="font-mono text-[10px] text-orange border border-orange px-3 py-2">{serverError}</p>
      )}

      <form.Subscribe selector={(s) => s.isSubmitting}>
        {(isSubmitting) => (
          <button type="submit" disabled={isSubmitting}
            className="w-full bg-ink text-cream py-3 font-mono text-[11px] tracking-[0.1em] uppercase hover:opacity-80 disabled:opacity-40 transition-opacity mt-1">
            {isSubmitting ? 'Creating account…' : 'Create Account'}
          </button>
        )}
      </form.Subscribe>
    </form>
  )
}
