import type { ReactNode } from 'react'
import { ArrowRight } from 'lucide-react'

interface AttentionReviewSectionProps {
  title: string
  description: string
  count: number
  action: string
  isPending: boolean
  isError: boolean
  onRetry: () => void
  emptyMessage: string
  emptyAction: ReactNode
  children: ReactNode
}

// Layer 2: a compact alert summary with an expandable list of review links.
export function AttentionReviewSection({
  title, description, count, action, isPending, isError, onRetry, emptyMessage, emptyAction, children,
}: AttentionReviewSectionProps) {
  const heading = <>
    <span className="min-w-0">
      <span className="block text-[13px] font-medium">{title}</span>
      <span className="block mt-1 text-[11px] text-ink-soft">{description}</span>
    </span>
    <span className="shrink-0 font-serif text-[36px] leading-none" aria-label={isPending || isError ? 'Count unavailable' : `${count} ${title.toLowerCase()}`}>
      {isPending || isError ? '—' : count}
    </span>
  </>

  if (isPending || isError || count === 0) return (
    <div className="border-t border-line-soft px-6 py-5">
      <div className="flex items-center justify-between gap-4">{heading}</div>
      {isPending ? <p role="status" className="mt-3 text-[12px] text-ink-soft">Checking {title.toLowerCase()}…</p>
        : isError ? <div role="alert" className="mt-3 text-[12px]">
          <p>Could not check {title.toLowerCase()}.</p>
          <button type="button" className="mt-2 underline underline-offset-4" onClick={onRetry}>Retry {title.toLowerCase()}</button>
        </div>
          : <><p className="mt-3 text-[12px] text-ink-soft">{emptyMessage}</p><div className="mt-3 font-mono text-[11px]">{emptyAction}</div></>}
    </div>
  )

  return (
    <details className="group border-t border-line-soft">
      <summary className="list-none cursor-pointer px-6 py-5 hover:bg-cream-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink [&::-webkit-details-marker]:hidden">
        <span className="flex items-center justify-between gap-4">{heading}</span>
        <span className="mt-3 inline-flex items-center gap-2 font-mono text-[11px]">
          {action}<ArrowRight size={14} aria-hidden="true" className="group-open:rotate-90 transition-transform" />
        </span>
      </summary>
      <ul className="border-t border-dashed border-line-soft divide-y divide-dashed divide-line-soft">{children}</ul>
    </details>
  )
}
