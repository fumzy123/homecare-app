import { router } from 'expo-router';
import { WorkerWelcome } from '@/features/auth/components/WorkerWelcome';

export default function IntroductionScreen() {
  return <WorkerWelcome replay onDone={() => router.replace('/(tabs)/home')} />;
}
