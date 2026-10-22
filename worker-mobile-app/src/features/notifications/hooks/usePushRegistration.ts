import { useMutation } from '@tanstack/react-query';
import type { DevicePushToken } from 'expo-notifications';
import { registerPush } from '../lib/pushRegistration';

export function usePushRegistration() {
  return useMutation({
    mutationFn: ({ userId, requestPermission, devicePushToken }: {
      userId: string;
      requestPermission: boolean;
      devicePushToken?: DevicePushToken;
    }) => registerPush(userId, requestPermission, devicePushToken),
    retry: false,
  });
}
