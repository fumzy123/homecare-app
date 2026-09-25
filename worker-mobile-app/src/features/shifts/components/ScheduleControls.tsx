import { Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { SchedulePeriod } from '../lib/schedule';
import { toDateKey } from '../lib/schedule';

export function PeriodToggle({
  value,
  onChange,
}: {
  value: SchedulePeriod;
  onChange: (value: SchedulePeriod) => void;
}) {
  return (
    <View className="mt-4 flex-row rounded-xl border border-cream-2 bg-paper p-1">
      {([
        ['week', 'Week'],
        ['two_weeks', '2 Weeks'],
      ] as const).map(([period, label]) => {
        const selected = value === period;
        return (
          <Pressable
            key={period}
            onPress={() => onChange(period)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            className={`flex-1 items-center rounded-lg py-2.5 ${selected ? 'bg-ink' : ''}`}
          >
            <Text className={`font-mono text-xs uppercase tracking-widest ${selected ? 'text-cream' : 'text-muted'}`}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function PeriodNavigator({
  label,
  onPrevious,
  onNext,
  onToday,
}: {
  label: string;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
}) {
  return (
    <View className="mt-4 flex-row items-center justify-between">
      <Pressable onPress={onPrevious} accessibilityLabel="Previous period" className="rounded-full bg-paper p-2.5">
        <Ionicons name="chevron-back" size={18} color="#111111" />
      </Pressable>
      <Text className="font-serif-medium text-lg text-ink">{label}</Text>
      <View className="flex-row items-center gap-2">
        <Pressable onPress={onToday} className="px-2 py-2" accessibilityLabel="Return to today">
          <Text className="font-sans text-sm font-semibold text-orange">Today</Text>
        </Pressable>
        <Pressable onPress={onNext} accessibilityLabel="Next period" className="rounded-full bg-paper p-2.5">
          <Ionicons name="chevron-forward" size={18} color="#111111" />
        </Pressable>
      </View>
    </View>
  );
}

export function PeriodStats({ hours, shifts, clients }: { hours: number; shifts: number; clients: number }) {
  const displayHours = Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
  return (
    <View className="mt-4 flex-row gap-2">
      {[
        ['Scheduled', `${displayHours}h`],
        ['Shifts', String(shifts)],
        ['Clients', String(clients)],
      ].map(([label, value]) => (
        <View key={label} className="flex-1 rounded-xl border border-cream-2 bg-paper px-3 py-3.5">
          <Text className="font-mono text-[9px] uppercase tracking-widest text-muted">{label}</Text>
          <Text className="mt-3 font-serif text-2xl text-ink">{value}</Text>
        </View>
      ))}
    </View>
  );
}

export function DaySelector({
  days,
  selectedDate,
  shiftDates,
  onSelect,
}: {
  days: Date[];
  selectedDate: string;
  shiftDates: Set<string>;
  onSelect: (date: string) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="mt-5"
      contentContainerStyle={{ gap: 8, paddingRight: 20 }}
    >
      {days.map((day) => {
        const key = toDateKey(day);
        const selected = key === selectedDate;
        const hasShift = shiftDates.has(key);
        const accessibilityLabel = day.toLocaleDateString(undefined, {
          weekday: 'long', month: 'long', day: 'numeric',
        });
        return (
          <Pressable
            key={key}
            onPress={() => onSelect(key)}
            accessibilityLabel={`${accessibilityLabel}${hasShift ? ', shifts scheduled' : ''}`}
            accessibilityState={{ selected }}
            className={`w-14 items-center rounded-xl border py-2.5 ${selected ? 'border-orange bg-orange' : 'border-cream-2 bg-paper'}`}
          >
            <Text className={`font-mono text-[9px] uppercase ${selected ? 'text-white' : 'text-muted'}`}>
              {day.toLocaleDateString(undefined, { weekday: 'short' })}
            </Text>
            <Text className={`mt-1 font-serif text-xl ${selected ? 'text-white' : 'text-ink'}`}>{day.getDate()}</Text>
            <View className={`mt-1 h-1 w-1 rounded-full ${hasShift ? (selected ? 'bg-white' : 'bg-orange') : 'bg-transparent'}`} />
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
