import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatTime } from '@/shared/utils/formatTime';
import { formatDuration } from '@/shared/utils/formatDuration';
import { serviceTypeLabel } from '../lib/schedule';
import { formatScheduleHours, occurrenceKey, type ScheduleDay } from '../lib/scheduleView';
import type { ShiftOccurrence } from '../types';

/** Layer 2: compact list of the selected period, supplied by the schedule hook. */
export function ScheduleAgenda({ days, todayKey, onSelectDay, onSelectShift }: {
  days: ScheduleDay[]; todayKey: string; onSelectDay: (date: Date) => void; onSelectShift: (shift: ShiftOccurrence) => void;
}) {
  return <View>
    <Text className="mb-3 text-xs leading-5 text-ink-soft">Your visits at a glance. Tap a day to see its itinerary.</Text>
    {days.map(day => <View key={day.key} className="mb-5">
      <View className="mb-1 flex-row items-center justify-between gap-2">
        <Pressable accessibilityRole="button" onPress={() => onSelectDay(day.date)} className="min-h-11 flex-1 justify-center py-2">
          <Text className="font-serif text-xl text-ink">{day.key === todayKey ? 'Today' : day.date.toLocaleDateString(undefined, { weekday: 'long' })}<Text className="font-serif-italic"> · {day.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</Text></Text>
        </Pressable>
        <Text className="text-xs text-ink-soft">{day.visitCount ? `${formatScheduleHours(day.hours)} hrs` : 'No visits'}</Text>
      </View>
      {day.visits.length ? <View className="overflow-hidden rounded-xl border border-cream-2 bg-paper">
        {day.visits.map(({ shift, isNext }, index) => <Pressable key={occurrenceKey(shift)} onPress={() => onSelectShift(shift)} accessibilityRole="button"
          accessibilityLabel={`${shift.client.first_name} ${shift.client.last_name}, ${formatTime(shift.start_time)}, ${shift.completion_status.replace('_', ' ')}`}
          className={`min-h-16 flex-row items-center gap-3 p-3 ${index ? 'border-t border-cream-2' : ''}`}>
          <View className="w-[72px]">
            <Text className="font-mono text-[10px] text-ink">{formatTime(shift.start_time)}</Text>
            <Text className="mt-1 text-[10px] text-ink-soft">{formatDuration(shift.start_time, shift.end_time, 'short')}</Text>
          </View>
          <View className="flex-1">
            <Text className="font-serif text-xl text-ink">{shift.client.first_name} {shift.client.last_name}</Text>
            <Text className="mt-1 text-xs leading-4 text-ink-soft">{serviceTypeLabel(shift.service_type)} · {isNext ? 'Up next' : shift.completion_status === 'no_show' ? 'Missed' : shift.completion_status.replace('_', ' ')}</Text>
            {shift.is_modification ? <Text className="mt-1 text-[10px] text-ink-soft">Updated visit</Text> : null}
          </View>
          <Ionicons name={shift.completion_status === 'completed' ? 'checkmark' : 'chevron-forward'} size={15} color={shift.completion_status === 'completed' ? '#32634F' : '#8A8378'} />
        </Pressable>)}
      </View> : <Text className="border-b border-cream-2 py-3 text-xs text-ink-soft">A day with no scheduled visits.</Text>}
    </View>)}
  </View>;
}
