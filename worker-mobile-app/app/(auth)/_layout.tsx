import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { router } from 'expo-router';
import { useAuthStore } from '@/shared/lib/auth-store';

export default function AuthLayout() {
  const { session, isLoading } = useAuthStore();

  useEffect(() => {
    if (!isLoading && session) {
      router.replace('/(tabs)/home');
    }
  }, [session, isLoading]);

  return <Stack screenOptions={{ headerShown: false }} />;
}
