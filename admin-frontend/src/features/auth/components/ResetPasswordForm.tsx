import { useForm } from '@tanstack/react-form'
import { useState, useEffect } from 'react'
import { z } from 'zod'
import { useNavigate, Link } from '@tanstack/react-router'
import { Eye, EyeOff } from 'lucide-react'
import { supabase } from '@/shared/lib/supabase'
import { authApi } from '@/features/auth/api'

const schema = z.object({
  password: z.string().min(8, 'Minimum 8 characters'),
  confirm:  z.string().min(1, 'Required'),
})

const labelClass = 'block font-mono text-[9px] tracking-[0.1em] uppercase text-ink-soft mb-1'
const inputClass = 'w-full bg-cream border border-ink px-3 py-2.5 font-mono text-[12px] text-ink focus:outline-none focus:ring-1 focus:ring-ink'

export function ResetPasswordForm() {
  const navigate      = useNavigate()
  const [ready, setReady]             = useState(false)
  const [done,  setDone]              = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm,  setShowConfirm]  = useState(false)
  const [serverError,  setServerError]  = useState<string | null>(null)

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  const form = useForm({
    defaultValues: { password: '', confirm: '' },
    onSubmit: async ({ value }) => {
      setServerError(null)
      try {
        await authApi.setNewPassword(value.password)
        setDone(true)
        setTimeout(() => navigate({ to: '/login' }), 3000)
      } catch (err: unknown) {
        setServerError(err instanceof Error ? err.message : 'Something went wrong')
      }
    },
  })

  if (done) {
    return (
      <div className="border-l-2 border-mint px-4 py-3 bg-cream-2">
        <p className="font-mono text-[10px] text-ink leading-relaxed">
          Password updated — redirecting you to sign in…
        </p>
      </div>
    )
  }

  if (!ready) {
    return (
      <div className="flex flex-col gap-4">
        <p className="font-mono text-[11px] text-ink-soft">Verifying your reset link…</p>
        <Link
          to="/login"
          className="font-mono text-[10px] text-ink-soft underline underline-offset-2 hover:text-ink transition-colors"
        >
          ← Back to sign in
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); form.handleSubmit() }} className="flex flex-col gap-5">

      <form.Field name="password" validators={{ onChange: ({ value }) => {
        const r = schema.shape.password.safeParse(value)
        return r.success ? undefined : r.error.issues[0].message
      }}}>
        {(field) => (
          <div>
            <label className={labelClass}>New password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                className={inputClass}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-soft hover:text-ink transition-colors"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {field.state.meta.errors[0] && (
              <p className="mt-1 font-mono text-[10px] text-orange">{field.state.meta.errors[0]}</p>
            )}
          </div>
        )}
      </form.Field>

      <form.Field name="confirm" validators={{ onChange: ({ value, fieldApi }) => {
        if (!value.trim()) return 'Required'
        if (value !== fieldApi.form.getFieldValue('password')) return 'Passwords do not match'
        return undefined
      }}}>
        {(field) => (
          <div>
            <label className={labelClass}>Confirm password</label>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                className={inputClass}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowConfirm((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-soft hover:text-ink transition-colors"
              >
                {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
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
            {isSubmitting ? 'Updating…' : 'Set new password'}
          </button>
        )}
      </form.Subscribe>
    </form>
  )
}
