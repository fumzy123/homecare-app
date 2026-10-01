import { ListChecks } from 'lucide-react'
import { useRouterState } from '@tanstack/react-router'
import { useAttention } from '../hooks/useAttention'

export function AttentionRestoreButton() {
  const { hidden, restore } = useAttention()
  const pathname = useRouterState({ select: s => s.location.pathname })
  if (!hidden || pathname.replace(/\/$/, '') === '/dashboard') return null
  return <button id="restore-action-tower" onClick={restore} className="flex items-center gap-2 p-2 font-mono text-[10px] hover:bg-cream-2" aria-label="Show Action Tower"><ListChecks size={16} /><span className="max-sm:hidden">Action Tower</span></button>
}
