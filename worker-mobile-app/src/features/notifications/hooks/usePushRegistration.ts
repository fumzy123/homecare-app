import { useMutation } from '@tanstack/react-query';
import { registerPush } from '../lib/pushRegistration';

export function usePushRegistration() {
  return useMutation({
    mutationFn: ({ userId, requestPermission }: { userId: string; requestPermission: boolean }) => registerPush(userId, requestPermission),
    retry: false,
  });
}
