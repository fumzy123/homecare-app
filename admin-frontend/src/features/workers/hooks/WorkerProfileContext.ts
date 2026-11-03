import { createContext, useContext } from 'react'
import type { OrgMember } from '@/features/org-members/api'

export const WorkerProfileContext = createContext<{
  worker: OrgMember
  today: string
  now: string
  timezone: string
} | null>(null)
export function useWorkerProfileContext() {
  const context = useContext(WorkerProfileContext)
  if (!context) throw new Error('Worker profile must be inside WorkerWorkspace')
  return context
}
