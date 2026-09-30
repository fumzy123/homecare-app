import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ShiftOccurrence } from '@/features/shifts/types';
import { formatTimeRange } from '@/shared/utils/formatTime';

export function NoteReminders({ shifts, onPress }: { shifts: ShiftOccurrence[]; onPress: (shift: ShiftOccurrence) => void }) {
  if (!shifts.length) return null;
  return <View className="my-2">
    <Text className="mb-1 font-mono text-[10px] uppercase tracking-wider text-ink-soft">{shifts.length} {shifts.length === 1 ? 'note' : 'notes'} to finish · Last 7 days</Text>
    {shifts.map(shift => <Pressable key={`${shift.shift_id}:${shift.date}`} onPress={() => onPress(shift)} accessibilityRole="button" className="min-h-14 flex-row items-center gap-3 py-3">
      <View className="h-9 w-9 items-center justify-center rounded-xl bg-orange-soft"><Ionicons name="document-text-outline" size={18} color="#A5431E" /></View>
      <View className="flex-1">
        <Text className="text-sm font-semibold text-ink">{shift.client.first_name} {shift.client.last_name}</Text>
        <Text className="mt-1 text-xs text-ink-soft">{new Date(shift.start_time).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · {formatTimeRange(shift.start_time, shift.end_time)}</Text>
      </View>
      <Ionicons name="arrow-forward" size={17} color="#4A453E" />
    </Pressable>)}
  </View>;
}
