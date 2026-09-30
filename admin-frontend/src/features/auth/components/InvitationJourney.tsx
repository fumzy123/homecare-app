import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { authApi } from '../api'
import { useInvitationAccount } from '../hooks/useInvitationAccount'
import { AcceptInviteForm } from './AcceptInviteForm'

const button = 'block w-full border border-ink bg-ink px-5 py-3 text-center text-sm text-cream disabled:opacity-50'
const input = 'w-full border border-ink bg-cream px-3 py-3 text-base'

function ResumeInvitation({ showIntroduction = true }: { showIntroduction?: boolean }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  return <>
    {showIntroduction ? <><h1 className="font-serif text-3xl">Finish joining your agency</h1>
    <p className="my-4 text-sm text-ink-soft">Open the invitation email from your agency to set up your account. If you already created a password, sign in below to continue.</p></> : null}
    <form className="space-y-4" onSubmit={async (event) => {
      event.preventDefault(); setPending(true); setError('')
      try { await authApi.signIn(email.trim(), password) }
      catch { setError('Unable to sign in. Check your email and password and try again.') }
      finally { setPending(false) }
    }}>
      <label className="block text-sm">Email<input className={input} type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} /></label>
      <label className="block text-sm">Password<input className={input} type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} /></label>
      {error ? <p role="alert" className="text-sm text-orange">{error}</p> : null}
      <button className={button} disabled={pending}>{pending ? 'Signing in…' : 'Continue setup'}</button>
      <Link to="/forgot-password" className="block text-sm underline">Forgot password?</Link>
    </form>
  </>
}

function DownloadApp({ agency, firstName, worker }: { agency: string | null; firstName: string | null; worker: boolean }) {
  const links = [
    { label: 'Download for iPhone', url: import.meta.env.VITE_WORKER_IOS_DOWNLOAD_URL },
    { label: 'Download for Android', url: import.meta.env.VITE_WORKER_ANDROID_DOWNLOAD_URL },
  ].filter(link => typeof link.url === 'string' && /^https:\/\//.test(link.url))
  return <>
    <p className="mb-3 font-mono text-xs uppercase tracking-widest">Account ready</p>
    <h1 className="font-serif text-4xl">Welcome{firstName ? `, ${firstName}` : ''}.</h1>
    <p className="my-5 text-ink-soft">Your account{agency ? ` with ${agency}` : ''} is ready.</p>
    {worker ? <>
      <p className="mb-6 text-sm leading-6">Sign in to the Homecare Worker app with the email and password you just set up. Your agency will be ready for you when you sign in.</p>
      <a className={button} href="worker-mobile-app://">Open the worker app</a>
      <div className="mt-3 space-y-3">{links.map(link => <a key={link.label} className="block border border-ink px-5 py-3 text-center text-sm" href={link.url} target="_blank" rel="noreferrer">{link.label}</a>)}</div>
      {links.length < 2 ? <p className="mt-4 text-sm text-ink-soft">A download link for your phone may not be available yet. Your agency will provide access when the app is available. Your account is already set up.</p> : null}
      <p className="mt-5 text-xs text-muted">Already installed? Tap “Open the worker app”. You will sign in securely inside the app.</p>
    </> : <Link to="/login" className={button}>Continue to agency sign-in</Link>}
  </>
}

export function InvitationJourney() {
  const { session, loadingSession, sessionError, account } = useInvitationAccount()
  const [linkError] = useState(() => {
    const params = new URLSearchParams(window.location.hash.slice(1))
    return params.has('error') || new URLSearchParams(window.location.search).has('error')
  })
  const [signOutError, setSignOutError] = useState(false)
  let content
  // A repeat click can carry an expired/used-token error while the browser still
  // has the session from the first click. Let the API verify that user's current
  // invitation or membership before deciding whether setup can continue.
  if (loadingSession || (session && account.isPending)) {
    content = <p role="status">Checking your agency invitation…</p>
  } else if (linkError && !session) {
    content = <><h1 className="font-serif text-3xl">This invitation link cannot be used.</h1><p className="mt-4 text-sm">This email link may have already been opened, expired, or been replaced. If you opened it earlier, return to the same browser to continue setup. If you already created a password, sign in below. Otherwise ask your agency for a new invitation.</p><div className="mt-6"><ResumeInvitation showIntroduction={false} /></div></>
  } else if (!session) {
    content = <>{sessionError ? <p role="alert">Your previous session could not be restored. Please sign in again.</p> : null}<ResumeInvitation /></>
  } else if (account.isError) {
    content = <><p role="alert">We could not check your invitation. Please try again.</p><button className={`${button} mt-4`} onClick={() => account.refetch()}>Try again</button></>
  } else if (account.data?.status === 'active') {
    content = <DownloadApp agency={account.data.org_name} firstName={account.data.first_name} worker={account.data.role === 'home_support_worker'} />
  } else if (account.data?.status === 'pending') {
    content = <>
      <p className="mb-2 font-mono text-xs uppercase tracking-widest">Agency invitation</p>
      <h1 className="font-serif text-3xl">Join {account.data.org_name}</h1>
      <p className="mt-3 mb-6 break-words text-sm text-ink-soft">Invited as {account.data.email}. Enter your name and create a password for your account.</p>
      <AcceptInviteForm />
    </>
  } else {
    content = <><h1 className="font-serif text-3xl">{account.data?.status === 'expired' ? 'Your invitation has expired.' : 'No active invitation found.'}</h1><p className="mt-4 text-sm">Ask your agency to send a new invitation. If you are signed into another account, sign out and open the original invitation email again.</p></>
  }
  return <main className="min-h-screen bg-cream px-5 py-12 text-ink">
    <div className="mx-auto max-w-lg border border-ink bg-paper p-6 sm:p-10">
      <p className="mb-8 font-serif text-xl">Homecare</p>
      {content}
      {session ? <button className="mt-8 text-sm underline" onClick={async () => {
        try { await authApi.signOut() } catch { setSignOutError(true) }
      }}>Not {session.user.email}? Sign out</button> : null}
      {signOutError ? <p role="alert">Could not sign out. Please try again.</p> : null}
    </div>
  </main>
}
