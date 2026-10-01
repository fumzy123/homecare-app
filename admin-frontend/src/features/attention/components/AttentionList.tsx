import { ArrowUpRight, ChevronRight } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import type { AttentionCategory, AttentionItem } from '../types'
import { actionLabels } from '../types'
import { DOCUMENT_LABELS } from '@/features/workers/constants'
interface Props {
  items: AttentionItem[]; loading: boolean; error: boolean; selectedId: string | null
  expanded: string[]; onExpanded: (id: string, open: boolean) => void
  onSelect: (item: AttentionItem) => void; onRetry: () => void
}
const categories: Array<[AttentionCategory, string, string]> = [
  ['coverage', 'Care coverage', 'Placements & visits'], ['credentials', 'Worker credentials', 'Expiring within 30 days & awaiting verification'],
  ['authorizations', 'Expiring authorizations', 'Within 15 days'], ['schedule', 'No visits this week', 'Active clients to review'],
]
// Layer 2: one controlled list for the dashboard and floating panel.
export function AttentionList({ items, loading, error, selectedId, expanded, onExpanded, onSelect, onRetry }: Props) {
  if (loading) return <p role="status" className="px-6 py-5 text-sm">Checking what needs attention…</p>
  if (error) return <div role="alert" className="px-6 py-5 text-sm"><p>Could not refresh attention checks.</p><button className="mt-3 underline underline-offset-4" onClick={onRetry}>Retry checks</button></div>
  const urgent = items.find(i => i.urgency === 'urgent')
  function row(item: AttentionItem, prominent = false) {
    return <div key={item.id} className={`px-6 py-4 ${selectedId === item.id ? 'border-l-[3px] border-ink' : ''}`}>
      <p className="text-sm font-medium">{item.subject}</p><p className="mt-1 text-xs text-ink-soft">{item.category === 'credentials' && item.target.document_type ? DOCUMENT_LABELS[item.target.document_type] ?? item.detail : item.detail}</p>
      {item.due_on && <p className="mt-1 font-mono text-[11px]">{format(parseISO(item.due_on), 'MMM d, yyyy')}</p>}
      <button onClick={() => onSelect(item)} className={prominent ? 'mt-4 inline-flex items-center gap-2 rounded-full border border-ink bg-ink px-4 py-2 font-mono text-xs text-cream hover:bg-paper hover:text-ink' : 'mt-3 inline-flex items-center gap-2 text-left font-mono text-xs underline underline-offset-4 hover:text-orange'}>{actionLabels[item.stage]}<ArrowUpRight size={14} aria-hidden="true" /></button>
    </div>
  }
  function group(id: string, title: string, subtitle: string, members: AttentionItem[]) {
    if (!members.length) return null
    const open = expanded.includes(id)
    const urgentCount = members.filter(i => i.urgency === 'urgent').length
    return <section key={id} className="border-t border-line-soft"><button aria-expanded={open} onClick={() => onExpanded(id, !open)} className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left hover:bg-cream-2"><span><span className="block text-sm">{title}</span><span className="mt-1 block font-mono text-[11px] text-ink-soft">{urgentCount > 0 ? <span className="text-orange">{urgentCount} urgent</span> : subtitle}</span></span><span className="flex items-center gap-3"><span className="font-serif text-3xl">{members.length}</span><ChevronRight size={15} className={open ? 'rotate-90' : ''} aria-hidden="true" /></span></button>{open && <div className="divide-y divide-line-soft border-t border-line-soft">{members.map(i => row(i))}</div>}</section>
  }
  return <>
    {urgent && <section className="border-b border-ink bg-orange"><div className="px-6 pt-5"><p className="font-mono text-[11px] uppercase tracking-widest">Needs action</p><h3 className="mt-3 font-serif text-[32px] leading-[1.05]">{urgent.stage === 'replace_worker' ? 'A visit needs a worker.' : urgent.category === 'coverage' ? 'Care coverage is due.' : urgent.category === 'credentials' ? 'A credential needs attention.' : 'Authorization ends today.'}</h3></div>{row(urgent, true)}</section>}
    {categories.map(([id, label, subtitle]) => group(id, label, subtitle, items.filter(i => i.category === id && i.id !== urgent?.id && i.urgency !== 'waiting')))}
    {group('waiting', 'Waiting for a response', 'Tracked · No immediate action', items.filter(i => i.urgency === 'waiting'))}
    {items.length === 0 && <p className="px-6 py-5 text-sm">No outstanding items in these checks.</p>}
    <details className="border-t border-line-soft px-6 py-4"><summary className="cursor-pointer font-mono text-[11px] text-ink-soft">About these checks</summary><p className="mt-3 text-xs leading-relaxed text-ink-soft">Dropped visits: past 7 and next 60 days. Credentials: expiring within 30 days or uploaded and awaiting verification. Authorizations: expiring within 15 days. Missing and already expired records are not comprehensively checked. No weekly visits is a review prompt, not evidence of missed care.</p></details>
  </>
}
