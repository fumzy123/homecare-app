import type { ReactNode } from 'react'

// Layer 2: the same bordered header/body pattern used by Settings sections.
export function BillingPanel({ label, title, action, children }: {
  label: string; title: string; action?: ReactNode; children: ReactNode
}) {
  return <section className="border border-ink bg-paper" aria-label={title}>
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-ink px-6 py-4">
      <div>
        <p className="font-mono text-[9px] tracking-[0.12em] uppercase text-ink-soft">{label}</p>
        <h2 className="font-serif text-[22px] leading-none font-medium mt-1">{title}</h2>
      </div>
      {action}
    </div>
    <div className="px-6 py-5 space-y-4">{children}</div>
  </section>
}
