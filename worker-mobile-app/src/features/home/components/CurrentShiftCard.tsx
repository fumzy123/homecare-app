import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatTimeRange } from '@/shared/utils/formatTime';
import type { ShiftOccurrence } from '@/features/shifts/types';

export function CurrentShiftCard({ shift, onPress }: { shift: ShiftOccurrence; onPress: () => void }) {
  return (
    <View className="mb-5 mt-4">
      <Text className="mb-2 font-mono text-xs uppercase tracking-widest text-muted">Current shift</Text>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`Current shift with ${shift.client.first_name} ${shift.client.last_name}. View details`}
        className="flex-row items-center rounded-xl border border-cream-2 bg-paper px-4 py-3"
      >
        <View className="flex-1 pr-3">
          <Text className="font-sans text-base font-semibold text-ink">{shift.client.first_name} {shift.client.last_name}</Text>
          <Text className="mt-1 font-mono text-xs text-ink">{formatTimeRange(shift.start_time, shift.end_time)}</Text>
          <Text className="mt-1 font-sans text-xs text-muted" numberOfLines={1}>{shift.location || `${shift.client.street}, ${shift.client.city}`}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#8A8378" />
      </Pressable>
    </View>
  );
}
