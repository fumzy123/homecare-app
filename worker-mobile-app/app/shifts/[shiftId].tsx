import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { ShiftDetailView } from '@/features/shifts/components/ShiftDetailView';

export default function ShiftDetailScreen() {
  const { shiftId, occurrenceDate } = useLocalSearchParams<{
    shiftId?: string;
    occurrenceDate?: string;
  }>();

  return (
    <SafeAreaView className="flex-1 bg-cream">
      <View className="flex-row items-center border-b border-cream-2 bg-paper px-5 py-3">
        <Pressable
          onPress={() => router.back()}
          className="mr-3 rounded-full p-2"
          accessibilityLabel="Back to schedule"
        >
          <Ionicons name="arrow-back" size={22} color="#111111" />
        </Pressable>
        <Text className="font-mono text-xs uppercase tracking-widest text-muted">Schedule</Text>
      </View>
      {shiftId && occurrenceDate ? (
        <ShiftDetailView shiftId={shiftId} occurrenceDate={occurrenceDate} />
      ) : (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="font-serif text-2xl text-ink">Shift not available.</Text>
        </View>
      )}
    </SafeAreaView>
  );
}
