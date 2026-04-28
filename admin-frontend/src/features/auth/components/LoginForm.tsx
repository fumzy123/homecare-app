import { useForm } from '@tanstack/react-form'
import { z } from 'zod'
import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { authApi } from '@/features/auth/api'

const schema = z.object({
  email:    z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

const labelClass = 'block font-mono text-[9px] tracking-[0.1em] uppercase text-ink-soft mb-1'
const inputClass = 'w-full bg-cream border border-ink px-3 py-2.5 font-mono text-[12px] text-ink focus:outline-none focus:ring-1 focus:ring-ink'

export function LoginForm() {
  const navigate = useNavigate()
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm({
    defaultValues: { email: '', password: '' },
    onSubmit: async ({ value }) => {
      setServerError(null)
      try {
        await authApi.signIn(value.email, value.password)
        navigate({ to: '/dashboard' })
      } catch (err: unknown) {
        setServerError(err instanceof Error ? err.message : 'Invalid email or password')
      }
    },
  })

  return (
    <form onSubmit={(e) => { e.preventDefault(); form.handleSubmit() }} className="flex flex-col gap-5">

      <form.Field name="email" validators={{ onChange: ({ value }) => {
        const r = schema.shape.email.safeParse(value)
        return r.success ? undefined : r.error.issues[0].message
      }}}>
        {(field) => (
          <div>
            <label className={labelClass}>Email</label>
            <input type="email" className={inputClass} value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
              placeholder="jane@sunrisehomecare.com" />
            {field.state.meta.errors[0] && (
              <p className="mt-1 font-mono text-[10px] text-orange">{field.state.meta.errors[0]}</p>
            )}
          </div>
        )}
      </form.Field>

      <form.Field name="password" validators={{ onChange: ({ value }) => {
        const r = schema.shape.password.safeParse(value)
        return r.success ? undefined : r.error.issues[0].message
      }}}>
        {(field) => (
          <div>
            <label className={labelClass}>Password</label>
            <input type="password" className={inputClass} value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
              placeholder="••••••••" />
            {field.state.meta.errors[0] && (
              <p className="mt-1 font-mono text-[10px] text-orange">{field.state.meta.errors[0]}</p>
            )}
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
            {isSubmitting ? 'Signing in…' : 'Sign In'}
          </button>
        )}
      </form.Subscribe>
    </form>
  )
}
