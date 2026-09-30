import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ShiftOccurrence } from '@/features/shifts/types';
import { formatTime } from '@/shared/utils/formatTime';

export function TomorrowPreview({ date, shifts, onPress }: { date: Date; shifts: ShiftOccurrence[]; onPress: () => void }) {
  return <Pressable onPress={onPress} accessibilityRole="button" className="mt-2 flex-row items-center gap-3 border-b border-cream-2 py-5">
    <View className="min-w-11 items-center rounded-xl border border-cream-2 bg-paper p-2">
      <Text className="font-mono text-[10px] uppercase text-ink-soft">{date.toLocaleDateString(undefined, { weekday: 'short' })}</Text>
      <Text className="font-mono text-xl text-ink">{String(date.getDate()).padStart(2, '0')}</Text>
    </View>
    <View className="flex-1">
      <Text className="text-sm font-semibold text-ink">A look at tomorrow</Text>
      <Text className="mt-1 text-xs text-ink-soft">{shifts.length ? `${shifts.length} ${shifts.length === 1 ? 'visit' : 'visits'} · First at ${formatTime(shifts[0].start_time)}` : 'No visits scheduled. View your week.'}</Text>
    </View>
    <Ionicons name="chevron-forward" size={16} color="#8A8378" />
  </Pressable>;
}
