import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/shared/stores/auth'

type CoverageDraft = {
  selected: Record<string, string>
  startsOn: string
  tab: 'coverage' | 'interest'
}

// A one-use, in-memory handoff for the explicit trip to the client revision.
// Never persist review tokens, confirmations or care notes in browser storage.
export function useCoverageReturnDraft(placementId: string) {
  const qc = useQueryClient()
  const userId = useAuthStore((s) => s.user?.id)
  const [initial] = useState(() =>
    qc.getQueryData<CoverageDraft>(['coverage-return', userId, placementId]),
  )
  useEffect(() => {
    qc.removeQueries({
      queryKey: ['coverage-return', userId, placementId],
      exact: true,
    })
  }, [qc, userId, placementId])
  return {
    initial,
    remember: (draft: CoverageDraft) => {
      const key = ['coverage-return', userId, placementId]
      qc.setQueryDefaults(key, { gcTime: 30 * 60 * 1000 })
      qc.setQueryData(key, draft)
    },
  }
}
