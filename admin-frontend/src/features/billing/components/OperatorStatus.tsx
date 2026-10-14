import type { ReactNode } from 'react'
import { Check, RefreshCw } from 'lucide-react'
import { operatorButton } from './operator-styles'

// Layer 2: controlled presentation shared by the operator workspace.
export function OperatorBadge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'success' | 'attention' }) {
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${tone === 'success' ? 'bg-mint-soft text-[#23594d]' : tone === 'attention' ? 'bg-orange-soft text-[#923511]' : 'bg-cream-2 text-ink-soft'}`}>
    <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-current" />{children}
  </span>
}

export function OperatorRefresh({ label, busy, onClick }: { label: string; busy: boolean; onClick: () => void }) {
  return <button type="button" className={`${operatorButton} !min-h-9 !px-2.5 !text-xs`} disabled={busy} onClick={onClick} aria-label={label} title={label}>
    <RefreshCw size={14} aria-hidden="true" className={busy ? 'motion-safe:animate-spin' : ''} />{busy ? 'Refreshing…' : 'Refresh'}
  </button>
}

export function OperatorClearState({ title, children }: { title: string; children: ReactNode }) {
  return <div className="flex items-start gap-3 rounded-xl bg-mint-soft/50 p-4">
    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-mint-soft text-[#23594d]"><Check size={16} aria-hidden="true" /></span>
    <div><p className="text-sm font-medium">{title}</p><p className="mt-1 text-xs leading-5 text-ink-soft">{children}</p></div>
  </div>
}
