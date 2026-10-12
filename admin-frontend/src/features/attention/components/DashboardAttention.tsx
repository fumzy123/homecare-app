import { AttentionList } from './AttentionList'
import { useAttention } from '../hooks/useAttention'
export function DashboardAttention() {
  const attention = useAttention()
  return <section aria-label="Needs attention" className="min-w-0 border border-ink bg-paper"><h2 className="border-b border-ink px-6 py-4 font-mono text-xs uppercase tracking-widest">B / Needs attention</h2><AttentionList {...attention} /></section>
}
