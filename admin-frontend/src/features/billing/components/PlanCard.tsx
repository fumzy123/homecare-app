const FEATURES = [
  'Unlimited workers & client profiles',
  'Shift scheduling & calendar view',
  'Attendance & leave tracking',
  'Bi-weekly timesheet export for payroll',
  'Progress notes per client visit',
  'Leave & absence management',
  'Team invitations & role management',
  'All future features included',
]

interface PlanCardProps {
  onGetStarted: () => void
}

export function PlanCard({ onGetStarted }: PlanCardProps) {
  return (
    <div className="border border-ink bg-paper flex flex-col">

      {/* Plan header */}
      <div className="px-8 py-7 border-b border-ink">
        <p className="font-mono text-[9px] tracking-[0.14em] uppercase text-ink-soft mb-4">
          Standard plan
        </p>
        <div className="flex items-end gap-2 mb-1">
          <span className="font-serif text-[64px] leading-none font-medium tracking-[-0.02em]">
            $700
          </span>
          <span className="font-mono text-[12px] text-ink-soft mb-2">USD / month</span>
        </div>
        <p className="font-mono text-[10px] text-muted tracking-[0.04em]">
          Billed monthly · Cancel anytime
        </p>
      </div>

      {/* Feature list */}
      <div className="px-8 py-7 flex-1 space-y-3.5">
        {FEATURES.map((feature) => (
          <div key={feature} className="flex items-start gap-3">
            <span className="font-mono text-[11px] text-mint mt-px shrink-0">✓</span>
            <p className="font-mono text-[11px] leading-snug">{feature}</p>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="px-8 pb-8 pt-2">
        <button
          onClick={onGetStarted}
          className="w-full bg-ink text-cream py-3.5 font-mono text-[11px] tracking-[0.1em] uppercase hover:opacity-80 transition-opacity"
        >
          Get started →
        </button>
        <p className="font-mono text-[9px] text-muted text-center mt-3 tracking-[0.06em]">
          Secured by Stripe
        </p>
      </div>

    </div>
  )
}
