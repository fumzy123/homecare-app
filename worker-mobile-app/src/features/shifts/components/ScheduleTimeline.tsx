import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatTime } from '@/shared/utils/formatTime';
import { serviceTypeLabel } from '../lib/schedule';
import type { ShiftOccurrence } from '../types';

const STATUS = {
  scheduled: { label: 'Upcoming', bg: 'bg-orange-soft', text: 'text-orange' },
  in_progress: { label: 'In progress', bg: 'bg-orange', text: 'text-white' },
  completed: { label: 'Completed', bg: 'bg-mint', text: 'text-ink-soft' },
  cancelled: { label: 'Cancelled', bg: 'bg-cream-2', text: 'text-muted' },
} as const;

export function ScheduleTimeline({
  shifts,
  onSelectShift,
}: {
  shifts: ShiftOccurrence[];
  onSelectShift: (shift: ShiftOccurrence) => void;
}) {
  return (
    <View className="mt-3">
      {shifts.map((shift, index) => {
        const status = STATUS[shift.completion_status];
        const accent = index % 2 === 0 ? 'border-l-orange' : 'border-l-mint-dark';
        return (
          <View key={`${shift.shift_id}-${shift.date}`} className="mb-3 flex-row">
            <View className="w-[78px] items-end pr-3 pt-3">
              <Text className="font-mono text-xs text-ink">{formatTime(shift.start_time)}</Text>
              <View className="my-1 h-3 w-px bg-muted" />
              <Text className="font-mono text-xs text-ink">{formatTime(shift.end_time)}</Text>
            </View>

            <Pressable
              onPress={() => onSelectShift(shift)}
              accessibilityRole="button"
              accessibilityLabel={`${shift.client.first_name} ${shift.client.last_name}, ${formatTime(shift.start_time)} to ${formatTime(shift.end_time)}, ${status.label}`}
              className={`flex-1 rounded-2xl border border-cream-2 border-l-4 bg-paper p-4 ${accent}`}
            >
              <View className="flex-row items-start justify-between gap-2">
                <View className="flex-1">
                  <Text className="font-serif-medium text-xl text-ink" numberOfLines={1}>
                    {shift.client.first_name} {shift.client.last_name}
                  </Text>
                  <Text className="mt-1 font-sans text-sm text-ink-soft">
                    {serviceTypeLabel(shift.service_type)}
                  </Text>
                </View>
                <View className={`rounded-full px-2.5 py-1 ${status.bg}`}>
                  <Text className={`font-mono text-[9px] uppercase tracking-wide ${status.text}`}>{status.label}</Text>
                </View>
              </View>
              {shift.location ? (
                <View className="mt-3 flex-row items-center gap-1.5">
                  <Ionicons name="location-outline" size={14} color="#8A8378" />
                  <Text className="flex-1 font-sans text-xs text-muted" numberOfLines={1}>{shift.location}</Text>
                </View>
              ) : null}
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

export function NoShiftsForDay() {
  return (
    <View className="mt-4 rounded-2xl border border-cream-2 bg-paper px-5 py-6">
      <Text className="font-serif text-xl text-ink">No shifts this day.</Text>
      <Text className="mt-2 font-sans text-sm leading-5 text-muted">
        Select another date to review your schedule.
      </Text>
    </View>
  );
}
