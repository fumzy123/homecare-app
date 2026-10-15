import { Link } from '@tanstack/react-router'

export function EmailLinkError() {
  return <main className="min-h-screen bg-cream px-5 py-12 text-ink">
    <div className="mx-auto max-w-lg border border-ink bg-paper p-6 sm:p-10">
      <p className="mb-8 font-serif text-xl">Care Harbor</p>
      <h1 className="font-serif text-3xl">This email link cannot be used.</h1>
      <p role="alert" className="my-5 text-sm leading-6">The link may have expired, already been used, or been replaced by a newer email. Choose how to continue.</p>
      <nav aria-label="Email link recovery" className="space-y-4 text-sm">
        <Link to="/forgot-password" className="block underline">Request a new password reset link</Link>
        <Link to="/confirm-email" className="block underline">Continue email confirmation</Link>
        <Link to="/accept-invite" className="block underline">Continue agency invitation</Link>
        <Link to="/login" className="block underline">Back to sign in</Link>
      </nav>
    </div>
  </main>
}
