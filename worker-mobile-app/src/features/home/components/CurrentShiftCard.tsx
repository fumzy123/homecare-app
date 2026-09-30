import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '@/shared/components/ui/Avatar';
import { getInitials } from '@/shared/utils/getInitials';
import { formatTimeRange } from '@/shared/utils/formatTime';
import { serviceTypeLabel } from '@/features/shifts/lib/schedule';
import type { ShiftOccurrence } from '@/features/shifts/types';

interface Props {
  shift: ShiftOccurrence;
  now: number;
  visitIndex: number;
  total: number;
  hasNote: boolean;
  onPress: () => void;
  onNotePress: () => void;
}

export function CurrentShiftCard({ shift, now, visitIndex, total, hasNote, onPress, onNotePress }: Props) {
  const start = Date.parse(shift.start_time);
  const end = Date.parse(shift.end_time);
  const progress = Math.min(100, Math.max(0, (now - start) / (end - start) * 100));
  const minutesLeft = Math.max(0, Math.ceil((end - now) / 60000));
  return <View className="mb-2 overflow-hidden rounded-2xl border border-cream-2 border-t-orange bg-paper p-4" style={{ borderTopWidth: 3 }}>
    <View className="flex-row flex-wrap items-center justify-between gap-2">
      <Text className="font-mono text-[10px] uppercase tracking-wider text-ink-soft">Your current visit</Text>
      <Text className="text-xs text-ink-soft">{shift.completion_status === 'in_progress' ? 'In progress' : 'Scheduled now'}</Text>
    </View>
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`View shift with ${shift.client.first_name} ${shift.client.last_name}`} className="my-4 flex-row items-center gap-3">
      <Avatar initials={getInitials(shift.client.first_name, shift.client.last_name)} size="md" />
      <View className="flex-1">
        <Text className="font-serif text-2xl text-ink">{shift.client.first_name} <Text className="font-serif-italic">{shift.client.last_name}</Text></Text>
        <Text className="mt-1 text-xs text-ink-soft">{serviceTypeLabel(shift.service_type)} · Visit {visitIndex} of {total}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color="#8A8378" />
    </Pressable>
    <View className="flex-row flex-wrap items-center justify-between gap-2">
      <Text className="font-mono text-xs text-ink">{formatTimeRange(shift.start_time, shift.end_time)}</Text>
      <Text className="text-xs text-ink-soft">{minutesLeft} min left</Text>
    </View>
    <View accessibilityRole="progressbar" accessibilityLabel="Scheduled visit time elapsed" accessibilityValue={{ min: 0, max: 100, now: Math.round(progress) }} className="mb-1 mt-3 h-1 overflow-hidden rounded-full bg-cream-2">
      <View className="h-1 bg-orange" style={{ width: `${progress}%` }} />
    </View>
    <Pressable onPress={onPress} accessibilityRole="button" className="min-h-11 flex-row items-center gap-2 py-3">
      <Ionicons name="clipboard-outline" size={17} color="#4A453E" />
      <Text className="flex-1 text-sm text-ink">Care instructions</Text>
      <Ionicons name="arrow-forward" size={16} color="#4A453E" />
    </Pressable>
    <Pressable onPress={onNotePress} accessibilityRole="button" className="min-h-12 flex-row items-center gap-2 rounded-full bg-orange px-4 py-3">
      <Ionicons name="create-outline" size={19} color="white" />
      <Text className="flex-1 text-sm font-semibold text-white">{hasNote ? 'View / add progress note' : 'Add progress note'}</Text>
      <Ionicons name="arrow-forward" size={18} color="white" />
    </Pressable>
  </View>;
}
