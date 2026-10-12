import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { SchedulePeriod } from '../lib/schedule';
import { formatScheduleHours, type ScheduleDay, type ScheduleLayout } from '../lib/scheduleView';

/** Layer 2: controlled, presentation-only calendar and view controls. */
export function PeriodToggle({ value, onChange }: { value: SchedulePeriod; onChange: (value: SchedulePeriod) => void }) {
  return <View className="mb-2 flex-row gap-1 rounded-xl bg-cream-2 p-1">
    {(['week', 'two_weeks'] as const).map(period => <Pressable key={period} onPress={() => onChange(period)} accessibilityRole="button"
      accessibilityState={{ selected: value === period }} className={`min-h-11 flex-1 items-center justify-center rounded-lg px-3 py-2.5 ${value === period ? 'bg-ink' : ''}`}>
      <Text className={`text-sm ${value === period ? 'text-paper' : 'text-ink-soft'}`}>{period === 'week' ? 'Week' : '2 weeks'}</Text>
    </Pressable>)}
  </View>;
}

export function PeriodNavigator({ label, period, onPrevious, onNext, onToday, onChooseDate }: {
  label: string; period: SchedulePeriod; onPrevious: () => void; onNext: () => void; onToday: () => void; onChooseDate: () => void;
}) {
  return <View className="flex-row flex-wrap items-center justify-between gap-x-1">
    <Pressable onPress={onChooseDate} accessibilityRole="button" accessibilityLabel={`Choose a date. Showing ${label}`} className="min-h-11 flex-row items-center gap-2 py-2">
      <Text className="font-serif text-xl text-ink">{label}</Text><Ionicons name="chevron-down" size={13} color="#4A453E" />
    </Pressable>
    <View className="flex-row items-center">
      <Pressable onPress={onToday} accessibilityRole="button" accessibilityLabel="Return to today" className="min-h-11 items-center justify-center px-2"><Text className="text-xs text-orange">Today</Text></Pressable>
      <Pressable onPress={onPrevious} accessibilityRole="button" accessibilityLabel={`Previous ${period === 'week' ? 'week' : '2 weeks'}`} className="h-11 w-11 items-center justify-center"><Ionicons name="chevron-back" size={18} color="#111111" /></Pressable>
      <Pressable onPress={onNext} accessibilityRole="button" accessibilityLabel={`Next ${period === 'week' ? 'week' : '2 weeks'}`} className="h-11 w-11 items-center justify-center"><Ionicons name="chevron-forward" size={18} color="#111111" /></Pressable>
    </View>
  </View>;
}

export function PeriodSummary({ hours, visits, period, loading }: { hours: number | null; visits: number; period: SchedulePeriod; loading: boolean }) {
  return <Text className="mb-4 mt-1 text-xs leading-5 text-ink-soft" accessibilityLiveRegion="polite">
    {hours === null ? loading ? 'Loading your schedule…' : 'Schedule totals unavailable' : <><Text className="font-semibold text-ink">{formatScheduleHours(hours)} hrs</Text> scheduled {period === 'week' ? 'this week' : 'over 2 weeks'} · <Text className="font-semibold text-ink">{visits} {visits === 1 ? 'visit' : 'visits'}</Text></>}
  </Text>;
}

export function DaySelector({ days, selectedDate, todayKey, hasData, onSelect }: {
  days: ScheduleDay[]; selectedDate: string; todayKey: string; hasData: boolean; onSelect: (date: Date) => void;
}) {
  const rows = [days.slice(0, 7), ...(days.length > 7 ? [days.slice(7)] : [])];
  return <View className="gap-2">
    {rows.map((row, index) => <View key={row[0].key} className={`flex-row gap-1 ${index ? 'border-t border-cream-2 pt-2' : ''}`}>
      {row.map(day => {
        const selected = day.key === selectedDate;
        const label = day.date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
        return <Pressable key={day.key} onPress={() => onSelect(day.date)} accessibilityRole="button" accessibilityState={{ selected }}
          accessibilityLabel={`${label}${day.key === todayKey ? ', today' : ''}, ${hasData ? `${formatScheduleHours(day.hours)} hours scheduled` : 'schedule unavailable'}`}
          className={`min-w-0 flex-1 items-center rounded-2xl px-0.5 py-3 ${selected ? 'bg-ink' : ''}`}>
          <Text className={`font-mono text-[9px] uppercase ${selected ? 'text-cream' : 'text-ink-soft'}`}>{day.date.toLocaleDateString(undefined, { weekday: 'short' })}</Text>
          <View className="relative my-1.5"><Text className={`font-serif text-2xl ${selected ? 'text-paper' : hasData && !day.visits.length ? 'text-muted' : 'text-ink'}`}>{day.date.getDate()}</Text>
            {day.key === todayKey ? <View className="absolute -right-1.5 top-0.5 h-1 w-1 rounded-full bg-orange" /> : null}
          </View>
          <Text className={`font-mono text-[9px] ${selected ? 'text-cream' : 'text-ink-soft'}`}>{hasData ? day.hours ? `${formatScheduleHours(day.hours)}h` : '—' : '·'}</Text>
        </Pressable>;
      })}
    </View>)}
  </View>;
}

export function ScheduleLayoutToggle({ value, onChange }: { value: ScheduleLayout; onChange: (value: ScheduleLayout) => void }) {
  return <View className="flex-row rounded-xl bg-cream-2 p-1">
    {(['day', 'list'] as const).map(layout => <Pressable key={layout} onPress={() => onChange(layout)} accessibilityRole="button"
      accessibilityState={{ selected: layout === value }} className={`min-h-11 min-w-11 items-center justify-center rounded-lg px-3 ${layout === value ? 'bg-paper' : ''}`}>
      <Text className="text-xs text-ink-soft">{layout === 'day' ? 'Day' : 'List'}</Text>
    </Pressable>)}
  </View>;
}
