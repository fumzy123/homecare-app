import { Redirect } from 'expo-router';
import { useAuthStore } from '@/shared/lib/auth-store';
import { useWorkerEntry } from '@/features/auth/hooks/useWorkerEntry';

export default function Index() {
  const { session, isLoading } = useAuthStore();
  const { ready } = useWorkerEntry();
  if (isLoading) return null;
  if (!session) return <Redirect href="/(auth)/login" />;
  return <Redirect href={ready ? '/(tabs)/home' : '/worker-welcome'} />;
}
