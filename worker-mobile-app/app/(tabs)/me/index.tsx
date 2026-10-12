import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { WorkerMe } from '@/features/profile/components/WorkerMe';

export default function MeScreen() {
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  return <SafeAreaView className="flex-1 bg-cream" edges={['top', 'left', 'right']}>
    <WorkerMe key={edit ?? 'overview'} openPersonalDetails={edit === 'personal'} />
  </SafeAreaView>;
}
