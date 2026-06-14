import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { authorizationsApi, type AuthorizationCreatePayload } from '../api'

export function useClientAuthorizations(clientId: string) {
  return useQuery({
    queryKey: ['authorizations', clientId],
    queryFn: () => authorizationsApi.list(clientId),
    enabled: !!clientId,
  })
}

export function useAuthorizationCompliance(clientId: string) {
  return useQuery({
    queryKey: ['authorization-compliance', clientId],
    queryFn: () => authorizationsApi.compliance(clientId),
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
    },
  })
}
