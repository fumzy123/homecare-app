import { useQuery } from '@tanstack/react-query'
import { clientsApi } from '@/features/clients/api'

export function useClients() {
  return useQuery({ queryKey: ['clients'], queryFn: () => clientsApi.listClients() })
}
