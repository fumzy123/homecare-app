import { SafeAreaView } from 'react-native-safe-area-context';
import { ScheduleView } from '@/features/shifts/components/ScheduleView';

export default function ScheduleScreen() {
  return (
    <SafeAreaView className="flex-1 bg-cream">
      <ScheduleView />
    </SafeAreaView>
  );
}
