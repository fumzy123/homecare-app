import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Kicker } from '@/shared/components/ui';
import { ShiftCard } from '@/features/shifts/components/ShiftCard';
import { useTodayShifts } from '@/features/shifts/hooks/useMyShifts';
import type { ShiftOccurrence } from '@/features/shifts/types';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning.';
  if (hour < 17) return 'Good afternoon.';
  return 'Good evening.';
}

function formatToday(): string {
  return new Date().toLocaleDateString('en-CA', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

function EmptyState() {
  return (
    <View className="mt-8 items-center px-4">
      <Text className="font-serif text-xl text-ink">No shifts today.</Text>
      <Text className="mt-2 text-center font-sans text-sm text-muted">
        Enjoy your day off. Your next shift will appear here when it's scheduled.
      </Text>
    </View>
  );
}

function ShiftList({ shifts }: { shifts: ShiftOccurrence[] }) {
  const active = shifts.filter((s) => s.completion_status !== 'cancelled');
  const nextShift = active.find((s) => s.completion_status !== 'completed');
  const laterShifts = active.filter(
    (s) => s !== nextShift && s.completion_status !== 'completed',
  );
  const completedShifts = active.filter((s) => s.completion_status === 'completed');

  if (active.length === 0) return <EmptyState />;

  return (
    <>
      {nextShift && (
        <View className="mb-6">
          <Kicker className="mb-3">Next Up</Kicker>
          <ShiftCard shift={nextShift} variant="featured" />
        </View>
      )}

      {laterShifts.length > 0 && (
        <View className="mb-6">
          <Kicker className="mb-3">Later Today</Kicker>
          {laterShifts.map((shift) => (
            <ShiftCard key={shift.shift_id} shift={shift} className="mb-3" />
          ))}
        </View>
      )}

      {completedShifts.length > 0 && (
        <View className="mb-6">
          <Kicker className="mb-3">Completed</Kicker>
          {completedShifts.map((shift) => (
            <ShiftCard key={shift.shift_id} shift={shift} className="mb-3 opacity-60" />
          ))}
        </View>
      )}
    </>
  );
}

export default function HomeScreen() {
  const { data: shifts = [], isLoading, isError } = useTodayShifts();

  return (
    <SafeAreaView className="flex-1 bg-cream">
      <ScrollView
        className="flex-1 px-6"
        contentContainerStyle={{ paddingTop: 24, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="mb-8">
          <Text className="font-serif text-3xl text-ink">{getGreeting()}</Text>
          <Text className="mt-1 font-mono text-xs uppercase tracking-widest text-muted">
            {formatToday()}
          </Text>
        </View>

        {isLoading && <ActivityIndicator color="#FF5A1F" className="mt-8" />}

        {isError && (
          <View className="mt-4 rounded-xl bg-rose px-4 py-3">
            <Text className="font-sans text-sm text-ink">
              Could not load shifts. Check your connection and try again.
            </Text>
          </View>
        )}

        {!isLoading && !isError && <ShiftList shifts={shifts} />}
      </ScrollView>
    </SafeAreaView>
  );
}
