import { useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Btn } from '@/shared/components/ui/Btn';
import { ProgressNoteSheet, type NoteTarget } from '@/features/notes/components/ProgressNoteSheet';
import { useWorkerSchedule } from '../hooks/useWorkerSchedule';
import { formatPeriodRange, fromDateKey, toDateKey } from '../lib/schedule';
import { shiftAddress } from '../lib/scheduleView';
import type { ShiftOccurrence } from '../types';
import { DaySelector, PeriodNavigator, PeriodSummary, PeriodToggle, ScheduleLayoutToggle } from './ScheduleControls';
import { ScheduleDatePicker } from './ScheduleDatePicker';
import { ScheduleAgenda } from './ScheduleAgenda';
import { ScheduleCareDialog } from './ScheduleCareDialog';
import { NoShiftsForDay, ScheduleTimeline } from './ScheduleTimeline';

/** Layer 3: composes controlled UI, owns navigation and device actions; queries live in hooks. */
export function ScheduleView() {
  const router = useRouter();
  const schedule = useWorkerSchedule();
  const { selection, shifts, notes, selectedDay } = schedule;
  const [showCalendar, setShowCalendar] = useState(false);
  const [careShift, setCareShift] = useState<ShiftOccurrence | null>(null);
  const [noteTarget, setNoteTarget] = useState<NoteTarget | null>(null);
  const todayKey = toDateKey(new Date(schedule.now));
  const hasData = shifts.isSuccess;

  function openShift(shift: ShiftOccurrence) {
    router.push({ pathname: '/shifts/[shiftId]', params: { shiftId: shift.shift_id, occurrenceDate: shift.date } });
  }
  function openNote(shift: ShiftOccurrence) {
    setNoteTarget({ shiftId: shift.shift_id, occurrenceDate: shift.date, clientName: `${shift.client.first_name} ${shift.client.last_name}` });
  }
  async function openDirections(shift: ShiftOccurrence) {
    const address = shiftAddress(shift);
    if (!address) return;
    try { await Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(address)}`); }
    catch { Alert.alert('Could not open directions', `The visit address is ${address}.`); }
  }
  function selectCalendarDate(date: Date) {
    schedule.selectDate(date);
    setShowCalendar(false);
  }

  return <>
    <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingTop: 22, paddingBottom: 28 }} showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={schedule.refresh.refreshing} onRefresh={schedule.refresh.onRefresh} tintColor="#FF5A1F" colors={['#FF5A1F']} />}>
      <View className="mb-4 flex-row items-center justify-between gap-3">
        <Text accessibilityRole="header" className="flex-1 font-serif text-4xl text-ink">My <Text className="font-serif-italic">schedule.</Text></Text>
        <Pressable onPress={() => setShowCalendar(true)} accessibilityRole="button" accessibilityLabel="Choose a date" className="h-11 w-11 items-center justify-center rounded-full border border-cream-2 bg-paper">
          <Ionicons name="calendar-outline" size={20} color="#111111" />
        </Pressable>
      </View>
      <PeriodToggle value={selection.period} onChange={schedule.changePeriod} />
      <View className="border-b border-cream-2 pb-4">
        <PeriodNavigator label={formatPeriodRange(selection.start, schedule.end)} period={selection.period}
          onPrevious={() => schedule.movePeriod(-1)} onNext={() => schedule.movePeriod(1)} onToday={schedule.returnToToday} onChooseDate={() => setShowCalendar(true)} />
        <PeriodSummary hours={hasData ? schedule.hours : null} visits={schedule.visitCount} period={selection.period} loading={shifts.isPending} />
        <DaySelector days={schedule.days} selectedDate={selection.selectedDate} todayKey={todayKey} hasData={hasData} onSelect={schedule.selectDate} />
      </View>
      <View className="mb-3 mt-5 flex-row flex-wrap items-center justify-between gap-2">
        <Text accessibilityRole="header" className="font-serif text-2xl text-ink">
          {selection.layout === 'list' ? selection.period === 'week' ? 'Your week' : 'Your two weeks'
            : <>{selection.selectedDate === todayKey ? 'Today' : selectedDay.date.toLocaleDateString(undefined, { weekday: 'long' })}<Text className="font-serif text-xl text-ink-soft"> · {selectedDay.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</Text></>}
        </Text>
        <ScheduleLayoutToggle value={selection.layout} onChange={schedule.changeLayout} />
      </View>
      {shifts.isPending ? <View className="items-center py-12"><ActivityIndicator accessibilityLabel="Loading your schedule" color="#FF5A1F" /></View>
        : shifts.isError ? <View className="rounded-2xl bg-orange-soft p-5">
          <Text accessibilityRole="alert" className="mb-3 text-sm leading-5 text-ink">Could not load your schedule. Check your connection and try again.</Text>
          <Btn onPress={schedule.refresh.onRefresh}>Try again</Btn>
        </View>
        : selection.layout === 'list' ? <ScheduleAgenda days={schedule.days} todayKey={todayKey} onSelectDay={schedule.selectDate} onSelectShift={openShift} />
        : selectedDay.visits.length ? <ScheduleTimeline day={selectedDay} now={schedule.now} onSelectShift={openShift} onDirections={shift => void openDirections(shift)} onCareInstructions={setCareShift} onNote={openNote} />
        : <NoShiftsForDay nextDay={schedule.nextWorkingDay?.date} onNextDay={() => { if (schedule.nextWorkingDay) schedule.selectDate(schedule.nextWorkingDay.date); }} onChooseDate={() => setShowCalendar(true)} />}
      {notes.isError && hasData ? <Pressable accessibilityRole="button" onPress={() => void notes.refetch()} className="mt-4 min-h-11 justify-center rounded-xl bg-orange-soft p-3">
        <Text className="text-xs leading-5 text-ink-soft">Progress note status unavailable. Tap to retry.</Text>
      </Pressable> : null}
      <View className="mt-6 flex-row items-center gap-2 border-t border-cream-2 pt-4">
        <Ionicons name="headset-outline" size={16} color="#4A453E" /><Text className="flex-1 text-xs leading-5 text-ink-soft">Need a schedule change? Contact your agency.</Text>
      </View>
    </ScrollView>
    {showCalendar ? <ScheduleDatePicker selectedDate={fromDateKey(selection.selectedDate)} todayKey={todayKey} onSelect={selectCalendarDate} onClose={() => setShowCalendar(false)} /> : null}
    {careShift ? <ScheduleCareDialog shift={careShift} onClose={() => setCareShift(null)} /> : null}
    {noteTarget ? <ProgressNoteSheet key={`${noteTarget.shiftId}:${noteTarget.occurrenceDate}`} target={noteTarget} onClose={() => setNoteTarget(null)} /> : null}
  </>;
}
