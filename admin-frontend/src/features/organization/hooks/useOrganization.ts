import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { organizationApi, type OrganizationUpdatePayload } from '../api'

export function useOrganization() {
  return useQuery({ queryKey: ['organization'], queryFn: organizationApi.getOrganization })
}

export function useUpdateOrganization() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: OrganizationUpdatePayload) => organizationApi.updateOrganization(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['organization'] }),
  })
}
