import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { orgMembersApi } from '@/features/org-members/api'

export function useWorkerCredentials(workerId: string) {
  return useQuery({
    queryKey: ['worker-credentials', workerId],
    queryFn: () => orgMembersApi.listCredentials(workerId),
  })
}

export function useVerifyCredential(workerId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ documentType, expiryDate }: { documentType: string; expiryDate: string }) =>
      orgMembersApi.verifyCredential(workerId, documentType, expiryDate),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worker-credentials', workerId] })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}
