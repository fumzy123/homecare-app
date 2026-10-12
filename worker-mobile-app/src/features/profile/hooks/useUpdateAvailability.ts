import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateMyAvailability } from '../api';

export function useUpdateAvailability() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateMyAvailability,
    onSuccess: profile => queryClient.setQueryData(['worker-profile'], profile),
  });
}
