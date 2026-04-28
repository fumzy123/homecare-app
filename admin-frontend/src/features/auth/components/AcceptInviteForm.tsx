import { useForm } from '@tanstack/react-form'
import { z } from 'zod'
import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { authApi } from '@/features/auth/api'

const schema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  last_name:  z.string().min(1, 'Last name is required'),
  password:   z.string().min(8, 'Password must be at least 8 characters'),
})

const labelClass = 'block font-mono text-[9px] tracking-[0.1em] uppercase text-ink-soft mb-1'
const inputClass = 'w-full bg-cream border border-ink px-3 py-2.5 font-mono text-[12px] text-ink focus:outline-none focus:ring-1 focus:ring-ink'

export function AcceptInviteForm() {
  const navigate = useNavigate()
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm({
    defaultValues: { first_name: '', last_name: '', password: '' },
    onSubmit: async ({ value }) => {
      setServerError(null)
      try {
        await authApi.acceptInvite(value)
        navigate({ to: '/welcome' })
      } catch (err: unknown) {
        setServerError(err instanceof Error ? err.message : 'Something went wrong')
      }
    },
  })

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); form.handleSubmit() }}
      className="flex flex-col gap-5"
    >
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
              {field.state.meta.errors[0] && (
                <p className="mt-1 font-mono text-[10px] text-orange">{field.state.meta.errors[0] as string}</p>
              )}
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
              {field.state.meta.errors[0] && (
                <p className="mt-1 font-mono text-[10px] text-orange">{field.state.meta.errors[0] as string}</p>
              )}
            </div>
          )}
        </form.Field>
      </div>

      <form.Field name="password" validators={{ onChange: ({ value }) => {
        const r = schema.shape.password.safeParse(value)
        return r.success ? undefined : r.error.issues[0].message
      }}}>
        {(field) => (
          <div>
            <label className={labelClass}>Password</label>
            <input type="password" className={inputClass} value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur} placeholder="At least 8 characters" />
            <p className="mt-1 font-mono text-[9px] text-muted">Minimum 8 characters</p>
            {field.state.meta.errors[0] && (
              <p className="mt-1 font-mono text-[10px] text-orange">{field.state.meta.errors[0] as string}</p>
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
            {isSubmitting ? 'Setting up…' : 'Complete Setup'}
          </button>
        )}
      </form.Subscribe>
    </form>
  )
}
