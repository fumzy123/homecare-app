import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateMyProfile } from '../api';
import type { WorkerProfileUpdatePayload } from '../types';

export function useUpdateMyProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: WorkerProfileUpdatePayload) => updateMyProfile(payload),
    onSuccess: profile => {
      queryClient.setQueryData(['worker-profile'], profile);
    },
  });
}
