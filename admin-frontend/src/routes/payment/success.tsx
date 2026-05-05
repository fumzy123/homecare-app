import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'

export const Route = createFileRoute('/payment/success')({
  component: PaymentSuccess,
})

function PaymentSuccess() {
  const queryClient = useQueryClient()

  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ['payment-status'] })
  }, [queryClient])

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-6">
      <div className="max-w-md w-full border border-ink bg-paper p-12 text-center">
        <div className="w-12 h-12 rounded-full bg-ink flex items-center justify-center mx-auto mb-8">
          <span className="text-cream text-[20px]">✓</span>
        </div>

        <p className="font-mono text-[9px] tracking-[0.15em] uppercase text-muted mb-3">
          Payment confirmed
        </p>
        <h1 className="font-serif text-[36px] leading-none font-medium tracking-[-0.02em] mb-4">
          Welcome to<br />
          <em>Homecare OS.</em>
        </h1>
        <p className="text-ink-soft text-[14px] leading-relaxed mb-10">
          Your lifetime access is active. Everything is set up and ready to go.
        </p>

        <Link to="/dashboard">
          <button className="w-full py-3.5 bg-ink text-cream font-mono text-[11px] tracking-[0.1em] uppercase hover:bg-orange transition-colors">
            Go to Dashboard →
          </button>
        </Link>
      </div>
    </div>
  )
}
