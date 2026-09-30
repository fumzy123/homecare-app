import { ActivityIndicator, Text, View } from 'react-native';
import { Btn } from '@/shared/components/ui/Btn';
import type { DailyCompletedHours } from '../lib/homeSummary';

interface WeeklyHoursBreakdownProps {
  weekStart: Date;
  weekEnd: Date;
  days: DailyCompletedHours[];
  completedHours: number | null;
  scheduledHours: number | null;
  loading: boolean;
  onRetry: () => void;
}

const formatHours = (hours: number) => Number(hours.toFixed(1)).toLocaleString();

/** Layer 2: daily rows accumulate into a distinct total; all data comes from props. */
export function WeeklyHoursBreakdown({ weekStart, weekEnd, days, completedHours, scheduledHours, loading, onRetry }: WeeklyHoursBreakdownProps) {
  const lastDay = new Date(weekEnd);
  lastDay.setDate(lastDay.getDate() - 1);
  const dateOptions = { month: 'long', day: 'numeric' } as const;
  return <>
    <Text className="text-sm text-ink-soft">{weekStart.toLocaleDateString(undefined, dateOptions)} – {lastDay.toLocaleDateString(undefined, dateOptions)}</Text>
    {loading ? <ActivityIndicator className="my-8" accessibilityLabel="Loading weekly hours" color="#FF5A1F" />
      : completedHours == null || scheduledHours == null ? <View className="mt-5">
        <Text accessibilityRole="alert" className="mb-3 text-sm text-ink-soft">Could not load your weekly hours.</Text>
        <Btn onPress={onRetry}>Try again</Btn>
      </View> : <>
        <Text accessibilityRole="header" className="mb-1 mt-6 font-serif text-xl text-ink">Daily breakdown</Text>
        {days.map(day => <View key={day.date} accessible className="flex-row items-center justify-between gap-4 border-b border-cream-2 py-3.5">
          <Text className="flex-1 text-sm text-ink-soft">{new Date(`${day.date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long' })}</Text>
          <Text className="text-sm text-ink-soft" style={{ fontVariant: ['tabular-nums'] }}>{formatHours(day.hours)} hrs</Text>
        </View>)}
        <View accessible className="flex-row items-center justify-between gap-4 border-t-2 border-ink-soft pb-2 pt-4">
          <Text className="flex-1 text-base font-semibold text-ink">Completed so far</Text>
          <Text className="text-2xl font-semibold text-ink" style={{ fontVariant: ['tabular-nums'] }}>{formatHours(completedHours)} <Text className="text-xs font-normal text-ink-soft">hrs</Text></Text>
        </View>
        <View accessible className="flex-row items-center justify-between gap-4 border-b border-cream-2 pb-5 pt-1">
          <Text className="flex-1 text-sm text-ink-soft">Scheduled this week</Text>
          <Text className="text-base font-semibold text-ink-soft" style={{ fontVariant: ['tabular-nums'] }}>{formatHours(scheduledHours)} <Text className="text-xs font-normal">hrs</Text></Text>
        </View>
        <Text className="mt-4 text-xs leading-5 text-ink-soft">Completed hours are estimated from scheduled visit durations until check-in and check-out times are available. Your current visit is excluded.</Text>
      </>}
  </>;
}
