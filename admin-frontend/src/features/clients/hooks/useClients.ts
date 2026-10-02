import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { clientsApi, type ClientCreatePayload } from '@/features/clients/api'

export function useClients() {
  return useQuery({
    queryKey: ['clients'],
    queryFn: () => clientsApi.listClients(),
  })
}

export function useClientNotes(clientId: string, from: string, to: string) {
  return useQuery({
    queryKey: ['client-notes', clientId, from, to],
    queryFn: () => clientsApi.getNotes(clientId, from, to),
    enabled: !!clientId,
  })
}

export function useSaveClient(clientId?: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: ClientCreatePayload) =>
      clientId
        ? clientsApi.updateClient(clientId, payload)
        : clientsApi.createClient(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['clients'] })
      void qc.invalidateQueries({ queryKey: ['client'] })
    },
  })
}

export function useClient(clientId: string) {
  return useQuery({
    queryKey: ['client', clientId],
    queryFn: () => clientsApi.getClient(clientId),
    enabled: !!clientId,
  })
}
