import { useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Kicker } from '@/shared/components/ui';
import { useRefreshControl } from '@/shared/hooks/useRefreshControl';
import { useMyShifts } from '../hooks/useMyShifts';
import {
  addDays,
  formatPeriodRange,
  getPeriodDays,
  scheduledHours,
  shiftsForDate,
  startOfMondayWeek,
  toDateKey,
  uniqueClientCount,
  type SchedulePeriod,
} from '../lib/schedule';
import { DaySelector, PeriodNavigator, PeriodStats, PeriodToggle } from './ScheduleControls';
import { NoShiftsForDay, ScheduleTimeline } from './ScheduleTimeline';

export function ScheduleView() {
  const router = useRouter();
  const today = useMemo(() => new Date(), []);
  const [period, setPeriod] = useState<SchedulePeriod>('week');
  const [periodStart, setPeriodStart] = useState(() => startOfMondayWeek(today));
  const [selectedDate, setSelectedDate] = useState(() => toDateKey(today));

  const days = useMemo(() => getPeriodDays(periodStart, period), [periodStart, period]);
  const periodEnd = days[days.length - 1];
  const fromDate = toDateKey(periodStart);
  const toDate = toDateKey(periodEnd);
  const { data: shifts = [], isLoading, isError, refetch } = useMyShifts(fromDate, toDate);
  const { refreshing, onRefresh } = useRefreshControl(refetch);

  const activeShifts = shifts.filter((shift) => shift.completion_status !== 'cancelled');
  const selectedShifts = shiftsForDate(shifts, selectedDate);
  const shiftDates = new Set(shifts.map((shift) => shift.date));

  function changePeriod(nextPeriod: SchedulePeriod) {
    setPeriod(nextPeriod);
    const selected = startOfMondayWeek(new Date(`${selectedDate}T00:00:00`));
    setPeriodStart(selected);
  }

  function movePeriod(direction: -1 | 1) {
    const interval = period === 'week' ? 7 : 14;
    const nextStart = addDays(periodStart, direction * interval);
    setPeriodStart(nextStart);
    setSelectedDate(toDateKey(nextStart));
  }

  function returnToToday() {
    setPeriodStart(startOfMondayWeek(today));
    setSelectedDate(toDateKey(today));
  }

  const selectedLabel = new Date(`${selectedDate}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <ScrollView
      className="flex-1 px-5"
      contentContainerStyle={{ paddingTop: 22, paddingBottom: 48 }}
      showsVerticalScrollIndicator={false}
      refreshControl={(
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#FF5A1F"
          colors={['#FF5A1F']}
        />
      )}
    >
      <Kicker>Schedule</Kicker>
      <Text className="mt-1 font-serif-semibold text-4xl text-ink">My schedule</Text>

      <PeriodToggle value={period} onChange={changePeriod} />
      <PeriodNavigator
        label={formatPeriodRange(periodStart, periodEnd)}
        onPrevious={() => movePeriod(-1)}
        onNext={() => movePeriod(1)}
        onToday={returnToToday}
      />

      <PeriodStats
        hours={scheduledHours(activeShifts)}
        shifts={activeShifts.length}
        clients={uniqueClientCount(activeShifts)}
      />

      <DaySelector
        days={days}
        selectedDate={selectedDate}
        shiftDates={shiftDates}
        onSelect={setSelectedDate}
      />

      <View className="mt-5 flex-row items-end justify-between border-b border-cream-2 pb-3">
        <View>
          <Text className="font-mono text-[10px] uppercase tracking-widest text-orange">Selected day</Text>
          <Text className="mt-1 font-serif-medium text-xl text-ink">{selectedLabel}</Text>
        </View>
        <Text className="font-mono text-xs text-muted">
          {selectedShifts.length} {selectedShifts.length === 1 ? 'shift' : 'shifts'}
        </Text>
      </View>

      {isLoading && !refreshing ? (
        <View className="items-center py-12"><ActivityIndicator color="#FF5A1F" /></View>
      ) : isError ? (
        <View className="mt-4 rounded-2xl bg-rose px-5 py-4">
          <Text className="font-sans text-sm text-ink">Could not load your schedule. Pull down to try again.</Text>
        </View>
      ) : selectedShifts.length ? (
        <ScheduleTimeline
          shifts={selectedShifts}
          onSelectShift={(shift) => router.push({
            pathname: '/shifts/[shiftId]',
            params: { shiftId: shift.shift_id, occurrenceDate: shift.date },
          })}
        />
      ) : (
        <NoShiftsForDay />
      )}
    </ScrollView>
  );
}
