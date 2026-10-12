import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '@/shared/components/ui/Avatar';
import { getInitials } from '@/shared/utils/getInitials';
import { formatDuration } from '@/shared/utils/formatDuration';
import { formatTimeRange } from '@/shared/utils/formatTime';
import { serviceTypeLabel } from '@/features/shifts/lib/schedule';
import type { ShiftOccurrence } from '@/features/shifts/types';

interface Props {
  shift: ShiftOccurrence;
  shiftIndex: number;
  totalToday: number;
  gapMinutes: number | null;
  onDetailsPress: () => void;
  onDirectionsPress: () => void;
}

export function NextShiftCard({ shift, shiftIndex, totalToday, gapMinutes, onDetailsPress, onDirectionsPress }: Props) {
  const address = shift.location || [shift.client.street, shift.client.city].filter(Boolean).join(', ');
  const gap = gapMinutes == null ? null : gapMinutes >= 60
    ? `${Math.floor(gapMinutes / 60)} hr${gapMinutes % 60 ? ` ${gapMinutes % 60} min` : ''}` : `${gapMinutes} min`;
  return <View className="mt-4">
    <View className="mb-2.5 flex-row flex-wrap items-center justify-between gap-2">
      <Text accessibilityRole="header" className="font-serif text-2xl text-ink">Up next</Text>
      <Text className="font-mono text-[10px] uppercase tracking-wider text-ink-soft">{shiftIndex === totalToday ? 'Last visit today' : `Visit ${shiftIndex} of ${totalToday}`}</Text>
    </View>
    <View className="rounded-2xl bg-ink p-5">
      <View className="flex-row flex-wrap items-baseline justify-between gap-2">
        <Text className="font-mono text-base text-cream">{formatTimeRange(shift.start_time, shift.end_time)}</Text>
        <Text className="text-xs text-cream/70">{formatDuration(shift.start_time, shift.end_time, 'short')}</Text>
      </View>
      <Pressable onPress={onDetailsPress} accessibilityRole="button" className="my-4 flex-row items-center gap-3">
        <Avatar initials={getInitials(shift.client.first_name, shift.client.last_name)} size="md" className="bg-orange" />
        <View className="flex-1">
          <Text className="font-serif text-2xl text-cream">{shift.client.first_name} <Text className="font-serif-italic">{shift.client.last_name}</Text></Text>
          <Text className="mt-1 text-xs text-cream/70">{serviceTypeLabel(shift.service_type)}</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color="#F2EEE5" />
      </Pressable>
      <View className="flex-row items-start gap-2">
        <Ionicons name="location-outline" size={15} color="#EDE8DC" />
        <Text className="flex-1 text-xs leading-5 text-cream/80">{address || 'Location not provided'}</Text>
      </View>
      {gap != null ? <View className="mt-4 flex-row items-center gap-2 border-t border-cream/20 pt-3">
        <Ionicons name="cafe-outline" size={17} color="#EDE8DC" />
        <View className="flex-1">
          <Text className="text-xs text-cream">{gapMinutes === 0 ? 'Back-to-back visits' : `${gap} between visits`}</Text>
          <Text className="mt-1 text-xs text-cream/70">{gapMinutes === 0 ? 'Review travel arrangements with your agency' : 'Includes time for travel and a break'}</Text>
        </View>
      </View> : null}
      <View className="mt-4 flex-row gap-2.5">
        {address ? <Pressable onPress={onDirectionsPress} accessibilityRole="button" className="min-h-11 flex-1 flex-row items-center justify-center gap-2 rounded-full bg-cream px-2 py-3">
          <Ionicons name="navigate-outline" size={15} color="#111111" /><Text className="text-sm text-ink">Directions</Text>
        </Pressable> : null}
        <Pressable onPress={onDetailsPress} accessibilityRole="button" className="min-h-11 flex-1 flex-row items-center justify-center gap-2 rounded-full border border-cream/50 px-2 py-3">
          <Text className="text-sm text-cream">View shift</Text><Ionicons name="arrow-forward" size={15} color="#F2EEE5" />
        </Pressable>
      </View>
    </View>
  </View>;
}
