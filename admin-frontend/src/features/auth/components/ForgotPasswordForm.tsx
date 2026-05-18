import { useForm } from '@tanstack/react-form'
import { useState } from 'react'
import { z } from 'zod'
import { Link } from '@tanstack/react-router'
import { authApi } from '@/features/auth/api'

const schema = z.object({
  email: z.string().email('Invalid email address'),
})

const labelClass = 'block font-mono text-[9px] tracking-[0.1em] uppercase text-ink-soft mb-1'
const inputClass = 'w-full bg-cream border border-ink px-3 py-2.5 font-mono text-[12px] text-ink focus:outline-none focus:ring-1 focus:ring-ink'

export function ForgotPasswordForm() {
  const [sent, setSent]             = useState(false)
  const [sentEmail, setSentEmail]   = useState('')
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm({
    defaultValues: { email: '' },
    onSubmit: async ({ value }) => {
      setServerError(null)
      try {
        await authApi.sendPasswordResetEmail(value.email)
        setSentEmail(value.email)
        setSent(true)
      } catch (err: unknown) {
        setServerError(err instanceof Error ? err.message : 'Something went wrong')
      }
    },
  })

  if (sent) {
    return (
      <div className="flex flex-col gap-5">
        <div className="border-l-2 border-mint px-4 py-3 bg-cream-2">
          <p className="font-mono text-[10px] text-ink leading-relaxed">
            Check your inbox — we sent a reset link to <strong>{sentEmail}</strong>.
            The link is valid for 60 minutes.
          </p>
        </div>
        <Link to="/login" className="font-mono text-[10px] text-ink-soft underline underline-offset-2 hover:text-ink transition-colors">
          ← Back to sign in
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); form.handleSubmit() }} className="flex flex-col gap-5">

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
              placeholder="jane@sunrisehomecare.com"
            />
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
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-ink text-cream py-3 font-mono text-[11px] tracking-[0.1em] uppercase hover:opacity-80 disabled:opacity-40 transition-opacity mt-1"
          >
            {isSubmitting ? 'Sending…' : 'Send reset link'}
          </button>
        )}
      </form.Subscribe>

      <Link
        to="/login"
        className="font-mono text-[10px] text-ink-soft underline underline-offset-2 hover:text-ink transition-colors text-center"
      >
        ← Back to sign in
      </Link>
    </form>
  )
}
