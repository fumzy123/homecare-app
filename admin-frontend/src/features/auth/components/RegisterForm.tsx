import { useForm } from '@tanstack/react-form'
import { z } from 'zod'
import { useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { Eye, EyeOff } from 'lucide-react'
import { authApi } from '@/features/auth/api'
import { supabase } from '@/shared/lib/supabase'
import { legalApi, CURRENT_TERMS_VERSION } from '@/shared/lib/legal'
import { useAuthStore } from '@/shared/stores/auth'

const schema = z.object({
  organization_name: z.string().min(2, 'Organization name is required'),
  first_name:        z.string().min(1, 'First name is required'),
  last_name:         z.string().min(1, 'Last name is required'),
  email:             z.string().email('Invalid email address'),
  password:          z.string().min(8, 'Password must be at least 8 characters'),
  confirm_password:  z.string().min(1, 'Please confirm your password'),
})

const labelClass     = 'block font-mono text-[9px] tracking-[0.1em] uppercase text-ink-soft mb-1'
const inputClass     = 'w-full bg-cream border border-ink px-3 py-2.5 font-mono text-[12px] text-ink focus:outline-none focus:ring-1 focus:ring-ink'
const passwordInputClass = `${inputClass} [&::-ms-reveal]:hidden [&::-webkit-credentials-auto-fill-button]:hidden`

function FieldError({ error }: { error: unknown }) {
  if (!error) return null
  return <p className="mt-1 font-mono text-[10px] text-orange">{error as string}</p>
}

export function RegisterForm() {
  const navigate = useNavigate()
  const [serverError, setServerError]     = useState<string | null>(null)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [showPassword, setShowPassword]   = useState(false)
  const [showConfirm, setShowConfirm]     = useState(false)

  const form = useForm({
    defaultValues: { organization_name: '', first_name: '', last_name: '', email: '', password: '', confirm_password: '' },
    onSubmit: async ({ value }) => {
      setServerError(null)
      try {
        await authApi.registerDirect({
          email:             value.email,
          password:          value.password,
          organization_name: value.organization_name,
          first_name:        value.first_name,
          last_name:         value.last_name,
        })
        const { error } = await supabase.auth.signInWithPassword({ email: value.email, password: value.password })
        if (error) throw error
        await supabase.auth.refreshSession()
        await legalApi.acceptTerms(CURRENT_TERMS_VERSION)
        useAuthStore.getState().setTermsAccepted(CURRENT_TERMS_VERSION)
        navigate({ to: '/dashboard' })
      } catch (err: unknown) {
        setServerError(err instanceof Error ? err.message : 'Something went wrong')
      }
    },
  })

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
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                className={passwordInputClass}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                autoComplete="new-password"
                placeholder="••••••••"
              />
              <button type="button" onClick={() => setShowPassword((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-soft hover:text-ink transition-colors">
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <p className="mt-1 font-mono text-[9px] text-muted">Minimum 8 characters</p>
            <FieldError error={field.state.meta.errors[0]} />
          </div>
        )}
      </form.Field>

      {/* Confirm password */}
      <form.Field name="confirm_password" validators={{ onChange: ({ value, fieldApi }) => {
        if (!value) return 'Please confirm your password'
        if (value !== fieldApi.form.getFieldValue('password')) return 'Passwords do not match'
        return undefined
      }}}>
        {(field) => (
          <div>
            <label className={labelClass}>Confirm Password</label>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                className={passwordInputClass}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                autoComplete="new-password"
                placeholder="••••••••"
              />
              <button type="button" onClick={() => setShowConfirm((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-soft hover:text-ink transition-colors">
                {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <FieldError error={field.state.meta.errors[0]} />
          </div>
        )}
      </form.Field>

      {/* Terms checkbox */}
      <label className="flex items-start gap-3 cursor-pointer group mt-1">
        <div className="relative mt-0.5 shrink-0">
          <input
            type="checkbox"
            checked={termsAccepted}
            onChange={(e) => setTermsAccepted(e.target.checked)}
            className="sr-only"
          />
          <div className={`w-4 h-4 border flex items-center justify-center transition-colors ${
            termsAccepted ? 'bg-ink border-ink' : 'bg-cream border-ink group-hover:bg-cream-2'
          }`}>
            {termsAccepted && (
              <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                <path d="M1 4L3.5 6.5L9 1" stroke="#F5F0E8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
        </div>
        <p className="font-mono text-[10px] text-ink-soft leading-relaxed">
          I agree to the{' '}
          <Link to="/terms" target="_blank" rel="noopener noreferrer" className="text-ink underline underline-offset-2 hover:text-orange transition-colors">Terms of Service</Link>
          {', '}
          <Link to="/privacy" target="_blank" rel="noopener noreferrer" className="text-ink underline underline-offset-2 hover:text-orange transition-colors">Privacy Policy</Link>
          {', and '}
          <Link to="/dpa" target="_blank" rel="noopener noreferrer" className="text-ink underline underline-offset-2 hover:text-orange transition-colors">Data Processing Agreement</Link>
          {' on behalf of my organisation.'}
        </p>
      </label>

      {serverError && (
        <p className="font-mono text-[10px] text-orange border border-orange px-3 py-2">{serverError}</p>
      )}

      <form.Subscribe selector={(s) => s.isSubmitting}>
        {(isSubmitting) => (
          <button type="submit" disabled={isSubmitting || !termsAccepted}
            className="w-full bg-ink text-cream py-3 font-mono text-[11px] tracking-[0.1em] uppercase hover:opacity-80 disabled:opacity-40 transition-opacity mt-1">
            {isSubmitting ? 'Creating account…' : 'Create Account'}
          </button>
        )}
      </form.Subscribe>
    </form>
  )
}
