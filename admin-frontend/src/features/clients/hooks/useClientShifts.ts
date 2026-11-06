import { useQuery } from '@tanstack/react-query'
import { shiftsApi } from '@/features/shifts/api'

export function useClientShifts(clientId: string, from: string, to: string) {
  return useQuery({
    queryKey: ['shifts', from, to, '', clientId],
    queryFn: () => shiftsApi.listShifts(from, to, undefined, clientId),
  })
}
