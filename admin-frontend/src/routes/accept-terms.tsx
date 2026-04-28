import { createFileRoute, redirect, Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useAuthStore } from '@/shared/stores/auth'
import { legalApi, CURRENT_TERMS_VERSION } from '@/shared/lib/legal'
import { Btn } from '@/shared/components/ui'

export const Route = createFileRoute('/accept-terms')({
  beforeLoad: () => {
    const { accessToken, termsAcceptedVersion } = useAuthStore.getState()
    if (!accessToken) throw redirect({ to: '/login' })
    if (termsAcceptedVersion === CURRENT_TERMS_VERSION) throw redirect({ to: '/dashboard' })
  },
  component: AcceptTermsPage,
})

function AcceptTermsPage() {
  const [checked, setChecked] = useState(false)
  const navigate = useNavigate()
  const setTermsAccepted = useAuthStore((s) => s.setTermsAccepted)

  const accept = useMutation({
    mutationFn: () => legalApi.acceptTerms(CURRENT_TERMS_VERSION),
    onSuccess: () => {
      setTermsAccepted(CURRENT_TERMS_VERSION)
      navigate({ to: '/dashboard' })
    },
    onError: (err) => {
      console.error('[accept-terms] failed:', err)
    },
  })

  return (
    <div className="min-h-screen bg-cream flex flex-col">
      {/* Nav */}
      <div className="border-b border-ink px-8 py-4 flex items-center bg-paper">
        <div className="flex items-center gap-3">
          <svg width="22" height="22" viewBox="0 0 28 28" fill="none">
            <rect x="0.5" y="0.5" width="27" height="27" stroke="#111" />
            <path d="M 7 21 L 7 9 L 14 17 L 14 9 L 21 17 L 21 21" stroke="#111" strokeWidth="1.5" fill="none" />
            <circle cx="21" cy="7" r="2.5" fill="#FF5A1F" />
          </svg>
          <span className="font-serif text-[16px] leading-none tracking-[-0.02em] font-medium">Homecare</span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-[520px]">

          <p className="font-mono text-[10px] tracking-[0.12em] uppercase text-ink-soft mb-4">
            Before you continue
          </p>
          <h1 className="font-serif text-[36px] leading-[1.05] font-medium tracking-[-0.02em] mb-4">
            Review & accept our terms
          </h1>
          <p className="font-mono text-[12px] text-ink-soft leading-relaxed mb-10">
            We've updated our legal documents. Please review them before accessing your dashboard.
            Your continued use of the platform constitutes agreement on behalf of your organisation.
          </p>

          {/* Document links */}
          <div className="border border-ink bg-paper divide-y divide-ink mb-8">
            {[
              { to: '/terms', label: 'Terms of Service', desc: 'Usage rights, liability, billing, and termination' },
              { to: '/privacy', label: 'Privacy Policy', desc: 'How we collect, store, and protect personal data' },
              { to: '/dpa', label: 'Data Processing Agreement', desc: 'Our obligations as a data processor under PIPEDA' },
            ].map(({ to, label, desc }) => (
              <Link
                key={to}
                to={to as '/terms' | '/privacy' | '/dpa'}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between px-5 py-4 hover:bg-cream-2 transition-colors group"
              >
                <div>
                  <p className="font-mono text-[12px] font-medium text-ink">{label}</p>
                  <p className="font-mono text-[10px] text-ink-soft mt-0.5">{desc}</p>
                </div>
                <span className="font-mono text-[11px] text-muted group-hover:text-ink transition-colors">↗</span>
              </Link>
            ))}
          </div>

          {/* Checkbox */}
          <label className="flex items-start gap-3 cursor-pointer mb-8 group">
            <div className="relative mt-0.5 shrink-0">
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => setChecked(e.target.checked)}
                className="sr-only"
              />
              <div className={`w-4 h-4 border flex items-center justify-center transition-colors ${
                checked ? 'bg-ink border-ink' : 'bg-paper border-ink group-hover:bg-cream-2'
              }`}>
                {checked && (
                  <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                    <path d="M1 4L3.5 6.5L9 1" stroke="#F5F0E8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
            </div>
            <p className="font-mono text-[11px] text-ink leading-relaxed">
              I confirm I have read and agree to the Terms of Service, Privacy Policy, and Data Processing
              Agreement on behalf of my organisation. I have authority to bind my organisation to these terms.
            </p>
          </label>

          {/* Error */}
          {accept.isError && (
            <p className="font-mono text-[11px] text-orange mb-4">
              {(accept.error as any)?.code === 'ECONNABORTED'
                ? 'Request timed out — make sure the backend server is running.'
                : (accept.error as any)?.response?.data?.error?.message
                  ?? 'Something went wrong. Check the browser console for details.'}
            </p>
          )}

          {/* Submit */}
          <Btn
            variant="primary"
            onClick={() => accept.mutate()}
            disabled={!checked || accept.isPending}
            className="w-full justify-center"
          >
            {accept.isPending ? 'Saving…' : 'I Accept — Continue to Dashboard'}
          </Btn>

          <p className="font-mono text-[10px] text-muted mt-4 leading-relaxed text-center">
            Version {CURRENT_TERMS_VERSION} · Effective {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  )
}
