import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { authorizationsApi, type AuthorizationCreatePayload } from '../api'

export function useClientAuthorizations(clientId: string) {
  return useQuery({
    queryKey: ['authorizations', clientId],
    queryFn: () => authorizationsApi.list(clientId),
    enabled: !!clientId,
  })
}

export function useExpiringAuthorizations() {
  return useQuery({
    queryKey: ['expiring-authorizations'],
    queryFn: () => authorizationsApi.expiring(15),
  })
}

export function useAuthorizationCompliance(clientId: string, onDate?: string) {
  return useQuery({
    queryKey: ['authorization-compliance', clientId, onDate],
    queryFn: () => authorizationsApi.compliance(clientId, onDate),
    enabled: !!clientId,
  })
}

export function useCreateAuthorization(clientId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: AuthorizationCreatePayload) => authorizationsApi.create(clientId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['authorizations', clientId] })
      qc.invalidateQueries({ queryKey: ['authorization-compliance', clientId] })
      qc.invalidateQueries({ queryKey: ['expiring-authorizations'] })
    },
  })
}

export function useCancelAuthorization(clientId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (authorizationId: string) => authorizationsApi.cancel(authorizationId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['authorizations', clientId] })
      qc.invalidateQueries({ queryKey: ['authorization-compliance', clientId] })
      qc.invalidateQueries({ queryKey: ['expiring-authorizations'] })
    },
  })
}
