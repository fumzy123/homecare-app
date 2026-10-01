import { createContext, useContext } from 'react'
import type { AttentionItem } from '../types'

export interface AttentionContextValue {
  items: AttentionItem[]
  loading: boolean
  error: boolean
  selectedId: string | null
  expanded: string[]
  onExpanded: (id: string, open: boolean) => void
  onSelect: (item: AttentionItem) => void
  onRetry: () => void
  hidden: boolean
  restore: () => void
}

export const AttentionContext = createContext<AttentionContextValue | null>(null)
export function useAttention() {
  const value = useContext(AttentionContext)
  if (!value) throw new Error('AttentionProvider is required')
  return value
}
