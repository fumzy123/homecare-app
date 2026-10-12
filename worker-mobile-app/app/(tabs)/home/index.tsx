import { SafeAreaView } from 'react-native-safe-area-context';
import { WorkerHome } from '@/features/home/components/WorkerHome';

export default function HomeScreen() {
  return <SafeAreaView className="flex-1 bg-cream" edges={['top', 'left', 'right']}><WorkerHome /></SafeAreaView>;
}
