import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ShiftStatusBadge } from '@/features/shifts/components/ShiftStatusBadge';
import { serviceTypeLabel } from '@/features/shifts/lib/schedule';
import type { WorkerShiftDetail } from '@/features/shifts/types';
import { formatTime } from '@/shared/utils/formatTime';

export function ClientVisitCard({ visit, recorded, onPress }: {
  visit: WorkerShiftDetail; recorded: boolean | null; onPress: () => void;
}) {
  const day = new Date(`${visit.occurrence_date}T00:00:00`);
  return <Pressable onPress={onPress} accessibilityRole="button"
    accessibilityLabel={`Open visit on ${day.toLocaleDateString()} at ${formatTime(visit.start_time)}`}
    className="mb-3 rounded-2xl border border-cream-2 bg-paper p-4 active:opacity-70">
    <View className="flex-row items-start gap-3">
      <View className="w-12 items-center rounded-xl bg-cream py-2">
        <Text className="font-mono text-[9px] uppercase text-muted">{day.toLocaleDateString(undefined, { weekday: 'short' })}</Text>
        <Text className="mt-1 font-serif text-3xl text-ink">{day.getDate()}</Text>
      </View>
      <View className="flex-1">
        <Text className="font-serif text-xl text-ink">{serviceTypeLabel(visit.service_type)}</Text>
        <Text className="mb-3 mt-1 font-mono text-[11px] text-ink-soft">{formatTime(visit.start_time)} – {formatTime(visit.end_time)}</Text>
        <ShiftStatusBadge status={visit.completion_status} />
      </View>
      <Ionicons name="chevron-forward" size={17} color="#8A8378" />
    </View>
    <View className="mt-3 flex-row items-center gap-2 border-t border-cream-2 pt-3">
      <Ionicons name={recorded ? 'document-text-outline' : 'time-outline'} size={15} color="#8A8378" />
      <Text className="flex-1 text-xs text-ink-soft">{recorded === null ? 'Open visit to view notes' : recorded ? 'Progress note on file' : 'No progress note on file'}</Text>
      <Text className="text-xs font-semibold text-orange">View visit</Text>
    </View>
  </Pressable>;
}
