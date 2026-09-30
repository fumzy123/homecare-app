import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as SecureStore from 'expo-secure-store';
import { apiClient } from '@/shared/lib/api-client';
import { useAuthStore } from '@/shared/lib/auth-store';

export type WorkerAccount = {
  status: 'active' | 'pending' | 'expired' | 'no_access';
  email: string;
  first_name: string | null;
  org_name: string | null;
  org_id: string | null;
  employment_id: string | null;
  role: string | null;
};

export function useWorkerEntry() {
  const userId = useAuthStore(state => state.user?.id);
  const queryClient = useQueryClient();
  const account = useQuery({
    queryKey: ['workerAccount', userId],
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get<WorkerAccount>('/me/account', { signal });
      return data;
    },
    enabled: !!userId,
    staleTime: 0,
    retry: false,
  });
  const isWorker = account.data?.status === 'active' && account.data.role === 'home_support_worker';
  const storageKey = `worker-intro-v1.${userId}.${account.data?.employment_id}`;
  const completionKey = ['workerIntro', userId, account.data?.employment_id];
  const completion = useQuery({
    queryKey: completionKey,
    queryFn: () => SecureStore.getItemAsync(storageKey),
    enabled: !!userId && isWorker,
    staleTime: Infinity,
    retry: false,
  });
  const finish = useMutation({
    mutationFn: async () => {
      if (!userId || !isWorker) throw new Error('Please sign in to your worker account.');
      await SecureStore.setItemAsync(storageKey, 'complete');
    },
    onSuccess: () => queryClient.setQueryData(completionKey, 'complete'),
  });
  return {
    account, completion, finish, isWorker,
    ready: !!userId && isWorker && !account.isError && completion.data === 'complete',
  };
}
