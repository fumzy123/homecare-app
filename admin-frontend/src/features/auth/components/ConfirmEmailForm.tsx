import type { User } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { z } from 'zod'
import { supabase } from '@/shared/lib/supabase'
import { useAuthStore } from '@/shared/stores/auth'
import { legalApi, CURRENT_TERMS_VERSION } from '@/shared/lib/legal'
import { authApi } from '../api'
import { VerificationNotice } from './VerificationNotice'

const profileSchema = z.object({ organization_name: z.string().trim().min(2), first_name: z.string().trim().min(1), last_name: z.string().trim().min(1) })

export function ConfirmEmailForm() {
  const navigate = useNavigate()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [accepted, setAccepted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [profile, setProfile] = useState({ organization_name: '', first_name: '', last_name: '' })

  useEffect(() => {
    let disposed = false
    async function load() {
      try {
        const hash = new URLSearchParams(window.location.hash.slice(1))
        if (hash.get('error')) throw new Error('This confirmation link has expired or is invalid. Request another below.')
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        if (sessionError) throw sessionError
        if (!session) return
        const { data, error: userError } = await supabase.auth.getUser()
        if (userError) throw userError
        if (disposed) return
        setUser(data.user)
        // Signup metadata contains profile input only, never authorization decisions.
        let pending: Record<string, unknown> = {}
        try { pending = JSON.parse(localStorage.getItem('pending_registration') ?? '{}') ?? {} } catch { /* Recover via the profile form. */ }
        const sameEmail = typeof pending.email === 'string' && pending.email.toLowerCase() === data.user.email?.toLowerCase()
        const stored = sameEmail ? { organization_name: pending.org_name, first_name: pending.first_name, last_name: pending.last_name } : null
        const parsed = profileSchema.safeParse(data.user.user_metadata?.registration ?? stored)
        if (parsed.success) setProfile(parsed.data)
        setAccepted(sameEmail && pending.terms_version === CURRENT_TERMS_VERSION)
      } catch (cause) {
        if (!disposed) setError(cause instanceof Error ? cause.message : 'Unable to verify your email. Please try again.')
      } finally { if (!disposed) setLoading(false) }
    }
    void load()
    return () => { disposed = true }
  }, [])

  async function finish(event: React.FormEvent) {
    event.preventDefault()
    if (busy || !accepted || !user?.email_confirmed_at) return
    setBusy(true)
    setError(null)
    try {
      const parsed = profileSchema.safeParse(profile)
      if (!parsed.success) throw new Error('Enter your agency name, first name, and last name.')
      const { data: { session } } = await supabase.auth.getSession()
      if (!session || session.user.id !== user.id) throw new Error('Your session changed. Sign in again to continue.')
      useAuthStore.getState().setAuth(session.access_token, {
        id: user.id, email: user.email ?? '', firstName: '', lastName: '', role: '',
      })
      await authApi.registerOrganization(parsed.data)
      const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession()
      if (refreshError) throw refreshError
      if (!refreshed.session) throw new Error('Sign in again to finish setup.')
      const current = refreshed.session.user
      useAuthStore.getState().setAuth(refreshed.session.access_token, {
        id: current.id, email: current.email ?? '', firstName: current.user_metadata?.first_name ?? '',
        lastName: current.user_metadata?.last_name ?? '', role: current.user_metadata?.role ?? '',
      })
      await legalApi.acceptTerms(CURRENT_TERMS_VERSION)
      useAuthStore.getState().setTermsAccepted(CURRENT_TERMS_VERSION)
      localStorage.removeItem('pending_registration')
      await navigate({ to: '/dashboard' })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Setup could not be completed. Please try again.')
    } finally { setBusy(false) }
  }

  if (loading) return <p role="status">Checking your email verification…</p>
  if (!user?.email_confirmed_at) return <div className="flex flex-col gap-4">
    {error && <p role="alert">{error}</p>}
    <VerificationNotice initialEmail={user?.email} />
  </div>

  return <form onSubmit={finish} className="flex flex-col gap-4 font-mono text-[12px]">
    <p role="status">Email verified: {user.email}. Confirm your agency details to continue.</p>
    {(['organization_name', 'first_name', 'last_name'] as const).map((field) => <label key={field} className="flex flex-col gap-2">
      {{ organization_name: 'Agency name', first_name: 'First name', last_name: 'Last name' }[field]}
      <input required value={profile[field]} onChange={(event) => setProfile({ ...profile, [field]: event.target.value })} className="border border-ink bg-cream p-3" />
    </label>)}
    <label className="flex items-start gap-2">
      <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />
      <span>I accept the <Link to="/terms" target="_blank" className="underline">Terms</Link>, <Link to="/privacy" target="_blank" className="underline">Privacy Policy</Link>, and <Link to="/dpa" target="_blank" className="underline">Data Processing Agreement</Link> on behalf of my agency.</span>
    </label>
    {error && <p role="alert" className="text-orange">{error}</p>}
    <button disabled={busy || !accepted} className="bg-ink text-cream p-3 disabled:opacity-40">{busy ? 'Finishing setup…' : 'Continue to dashboard'}</button>
  </form>
}
