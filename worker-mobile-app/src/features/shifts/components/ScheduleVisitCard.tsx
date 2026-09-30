import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '@/shared/components/ui/Avatar';
import { getInitials } from '@/shared/utils/getInitials';
import { formatDuration } from '@/shared/utils/formatDuration';
import { formatTimeRange } from '@/shared/utils/formatTime';
import { serviceTypeLabel } from '../lib/schedule';
import { shiftAddress, type ScheduleVisit } from '../lib/scheduleView';

const STATUS_LABELS = {
  scheduled: 'Scheduled', in_progress: 'In progress', completed: 'Completed',
  cancelled: 'Cancelled', dropped: 'Dropped', no_show: 'Missed',
};

/** Layer 2: a visit's appearance and callbacks; all status decisions arrive as props. */
export function ScheduleVisitCard({ visit, onPress, onDirections, onCareInstructions, onNote }: {
  visit: ScheduleVisit; onPress: () => void; onDirections: () => void; onCareInstructions: () => void; onNote: () => void;
}) {
  const { shift, isNext, isScheduledNow, noteStatus } = visit;
  const completed = shift.completion_status === 'completed';
  const address = shiftAddress(shift);
  const status = isNext ? 'Up next' : isScheduledNow ? 'Scheduled now' : STATUS_LABELS[shift.completion_status];
  const foreground = isNext ? 'text-cream' : 'text-ink';
  const secondary = isNext ? 'text-cream/80' : 'text-ink-soft';
  return <View className={`overflow-hidden rounded-2xl border ${isNext ? 'border-ink bg-ink' : 'border-cream-2 bg-paper'}`}>
    <Pressable onPress={onPress} accessibilityRole="button"
      accessibilityLabel={`View ${shift.client.first_name} ${shift.client.last_name}, ${formatTimeRange(shift.start_time, shift.end_time)}, ${status}`}
      className="p-4">
      <View className="mb-3 flex-row flex-wrap items-center justify-between gap-2">
        <View className="flex-row flex-wrap items-baseline gap-x-2 gap-y-1">
          <Text className={`font-mono text-xs ${foreground}`}>{formatTimeRange(shift.start_time, shift.end_time)}</Text>
          <Text className={`text-[10px] ${secondary}`}>{formatDuration(shift.start_time, shift.end_time, 'short')}</Text>
        </View>
        <View className="flex-row items-center gap-1">
          {completed ? <Ionicons name="checkmark" size={12} color="#32634F" /> : isNext ? <View className="h-1.5 w-1.5 rounded-full bg-mint" /> : null}
          <Text className={`text-[10px] ${isNext ? 'text-mint' : completed ? 'text-[#32634F]' : secondary}`}>{status}</Text>
        </View>
      </View>
      <View className="flex-row items-center gap-3">
        <Avatar initials={getInitials(shift.client.first_name, shift.client.last_name)} size="md" className={isNext ? 'bg-orange' : completed ? 'bg-mint/30' : 'bg-cream-2'} />
        <View className="min-w-0 flex-1">
          <Text className={`font-serif text-2xl ${foreground}`}>{shift.client.first_name} <Text className="font-serif-italic">{shift.client.last_name}</Text></Text>
          <Text className={`mt-1 text-xs ${secondary}`}>{serviceTypeLabel(shift.service_type)}</Text>
        </View>
        <Ionicons name="chevron-forward" size={15} color={isNext ? '#EDE8DC' : '#8A8378'} />
      </View>
      <View className="mt-3 flex-row items-start gap-1.5">
        <Ionicons name="location-outline" size={14} color={isNext ? '#EDE8DC' : '#4A453E'} />
        <Text className={`flex-1 text-xs leading-4 ${secondary}`}>{address || 'Location not provided'}</Text>
      </View>
    </Pressable>
    {noteStatus ? <Pressable onPress={onNote} accessibilityRole="button" accessibilityLabel={`${noteStatus === 'saved' ? 'View' : 'View or add'} progress note for ${shift.client.first_name} ${shift.client.last_name}`}
      className="mx-4 min-h-11 flex-row items-center gap-1.5 border-t border-cream-2 py-2">
      <Ionicons name={noteStatus === 'saved' ? 'document-text-outline' : 'create-outline'} size={14} color={noteStatus === 'saved' ? '#32634F' : '#4A453E'} />
      <Text className={`flex-1 text-xs ${noteStatus === 'saved' ? 'text-[#32634F]' : 'text-ink-soft'}`}>{noteStatus === 'saved' ? 'Progress note saved' : noteStatus === 'needed' ? 'Add progress note' : 'View / add progress note'}</Text>
      <Ionicons name="chevron-forward" size={13} color="#8A8378" />
    </Pressable> : null}
    {shift.is_modification ? <View className="mx-4 mb-3 flex-row items-center gap-2 rounded-lg bg-orange-soft px-3 py-2">
      <Ionicons name="sync-outline" size={13} color="#4A453E" /><Text className="text-xs text-ink-soft">Updated visit</Text>
    </View> : null}
    {isNext ? <View className="mx-4 flex-row border-t border-cream/20 py-1">
      {address ? <Pressable onPress={onDirections} accessibilityRole="button" accessibilityLabel={`Directions to ${address}`} className="min-h-11 flex-1 flex-row items-center justify-center gap-2 px-1 py-2">
        <Ionicons name="navigate-outline" size={15} color="#F2EEE5" /><Text className="text-xs text-cream">Directions</Text>
      </Pressable> : null}
      <Pressable onPress={onCareInstructions} accessibilityRole="button" className={`min-h-11 flex-1 flex-row items-center justify-center gap-2 px-1 py-2 ${address ? 'border-l border-cream/20' : ''}`}>
        <Ionicons name="clipboard-outline" size={15} color="#F2EEE5" /><Text className="text-xs text-cream">Care instructions</Text>
      </Pressable>
    </View> : null}
  </View>;
}
