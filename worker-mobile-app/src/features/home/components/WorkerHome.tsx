import { useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Dialog } from '@/shared/components/Dialog';
import { Btn } from '@/shared/components/ui/Btn';
import { formatTime } from '@/shared/utils/formatTime';
import type { ShiftOccurrence } from '@/features/shifts/types';
import { computeCredentialStatus, DOCUMENT_TYPE_LABELS } from '@/features/profile/types';
import { ProgressNoteSheet, type NoteTarget } from '@/features/notes/components/ProgressNoteSheet';
import { useWorkerHome } from '../hooks/useWorkerHome';
import { HomeHeader } from './HomeHeader';
import { WorkerStatsRow } from './WorkerStatsRow';
import { CurrentShiftCard } from './CurrentShiftCard';
import { NextShiftCard } from './NextShiftCard';
import { LaterTodaySection } from './LaterTodaySection';
import { NeedsYouToday, type UrgentAction } from './NeedsYouToday';
import { TomorrowPreview } from './TomorrowPreview';
import { CompactShiftRow } from './CompactShiftRow';
import { WeeklyHoursBreakdown } from './WeeklyHoursBreakdown';

/** Layer 3: owns home orchestration; cards are presentation-only compounds. */
export function WorkerHome() {
  const router = useRouter();
  const home = useWorkerHome();
  const { summary, shifts, notes, now, range } = home;
  const [noteTarget, setNoteTarget] = useState<NoteTarget | null>(null);
  const [sheet, setSheet] = useState<'hours' | 'streak' | 'tomorrow' | 'attention' | null>(null);
  function openShift(shift: ShiftOccurrence) {
    setSheet(null);
    router.push({ pathname: '/shifts/[shiftId]', params: { shiftId: shift.shift_id, occurrenceDate: shift.date } });
  }
  function openNote(shift: ShiftOccurrence) {
    setSheet(null);
    setNoteTarget({ shiftId: shift.shift_id, occurrenceDate: shift.date, clientName: `${shift.client.first_name} ${shift.client.last_name}` });
  }
  async function openDirections(shift: ShiftOccurrence) {
    const address = shift.location || [shift.client.street, shift.client.city].filter(Boolean).join(', ');
    try { await Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(address)}`); }
    catch { Alert.alert('Could not open directions', `The visit address is ${address}.`); }
  }
  const hasSchedule = shifts.isSuccess;
  const credentialActions = (home.credentials.isSuccess ? home.credentials.data : [])
    .map(credential => ({ credential, status: computeCredentialStatus(credential.expiry_date) }))
    .filter(({ status }) => status !== 'valid')
    .sort((a, b) => (a.credential.expiry_date ?? '').localeCompare(b.credential.expiry_date ?? ''))
    .map(({ credential, status }) => ({
      id: `credential:${credential.id}`,
      label: `Review ${DOCUMENT_TYPE_LABELS[credential.document_type]}`,
      description: `${status === 'expired' ? 'Expired' : 'Expires'} ${new Date(`${credential.expiry_date}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} · Open your profile`,
      status: status === 'expired' ? 'Expired credential' : 'Expiring soon',
      onPress: () => { setSheet(null); router.push('/(tabs)/me'); },
      expired: status === 'expired',
    }));
  const noteActions: UrgentAction[] = hasSchedule && notes.isSuccess ? summary.pendingNotes.map(shift => ({
    id: `note:${shift.shift_id}:${shift.date}`,
    label: `Add a note for ${shift.client.first_name} ${shift.client.last_name}`,
    description: `${new Date(shift.start_time).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · ${formatTime(shift.start_time)} · Completed visit`,
    status: 'Progress note needed',
    onPress: () => openNote(shift),
  })) : [];
  // Action items reflect unresolved records, independently of notification read state.
  const attentionActions: UrgentAction[] = [
    ...credentialActions.filter(action => action.expired),
    ...noteActions,
    ...credentialActions.filter(action => !action.expired),
  ];
  const hasCurrentNote = notes.isSuccess && summary.current != null && notes.data.some(n => n.shift_id === summary.current?.shift_id && n.occurrence_date === summary.current.date);
  return <>
    <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingTop: 20, paddingBottom: 24 }} showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={home.refresh.refreshing} onRefresh={home.refresh.onRefresh} tintColor="#FF5A1F" colors={['#FF5A1F']} />}>
      <HomeHeader firstName={home.profile.data?.first_name} now={now} notificationCount={home.notifications.data?.unread_count ?? 0} onNotificationsPress={() => router.push('/notifications')} />
      {hasSchedule ? <View className="mb-5 flex-row flex-wrap items-center gap-2">
        <Text className="text-sm text-ink-soft"><Text className="font-semibold">{summary.total} {summary.total === 1 ? 'visit' : 'visits'}</Text> today</Text>
        {summary.lastEnd != null ? <Text className="text-sm text-ink-soft">· {summary.lastEnd > now ? 'Scheduled finish' : 'Last visit ended'} <Text className="font-semibold">{formatTime(new Date(summary.lastEnd).toISOString())}</Text></Text> : null}
      </View> : <Text className="mb-5 text-sm text-ink-soft">{shifts.isPending ? 'Getting your day ready…' : 'Your schedule is unavailable'}</Text>}
      <WorkerStatsRow completedHours={hasSchedule ? summary.completedHours : null} scheduledHours={hasSchedule ? summary.scheduledHours : null}
        streak={home.stats.isSuccess ? home.stats.data.punctuality_streak : null} onHoursPress={() => setSheet('hours')} onStreakPress={() => setSheet('streak')} />
      <NeedsYouToday actions={attentionActions} onViewAll={() => setSheet('attention')} />
      {notes.isError ? <Pressable accessibilityRole="button" onPress={() => void notes.refetch()} className="mb-4 min-h-11 rounded-xl bg-orange-soft p-3">
        <Text className="text-sm text-ink">Note reminders unavailable. Tap to retry.</Text>
      </Pressable> : null}
      {shifts.isPending ? <View className="py-10"><ActivityIndicator accessibilityLabel="Loading your visits" color="#FF5A1F" /></View> : shifts.isError ? <View className="rounded-2xl bg-orange-soft p-4">
        <Text accessibilityRole="alert" className="mb-3 text-sm text-ink">Could not load your visits. Check your connection and try again.</Text>
        <Btn onPress={home.refresh.onRefresh}>Try again</Btn>
      </View> : <>
        {summary.current ? <CurrentShiftCard shift={summary.current} now={now} visitIndex={summary.currentIndex} total={summary.total} hasNote={hasCurrentNote}
          onPress={() => openShift(summary.current!)} onNotePress={() => openNote(summary.current!)} /> : null}
        {summary.next ? <NextShiftCard shift={summary.next} shiftIndex={summary.nextIndex} totalToday={summary.total} gapMinutes={summary.gapMinutes}
          onDetailsPress={() => openShift(summary.next!)} onDirectionsPress={() => void openDirections(summary.next!)} /> : !summary.current ? <View className="mt-3 rounded-2xl border border-cream-2 bg-paper p-5">
          <Text className="font-serif text-2xl text-ink">{summary.total ? 'No more visits scheduled today.' : 'A little room to breathe.'}</Text>
          <Text className="mt-2 text-sm leading-5 text-ink-soft">{summary.total ? 'Your notes and upcoming schedule are still close at hand.' : 'You have no visits scheduled today. Take a look at what’s ahead.'}</Text>
        </View> : null}
        <LaterTodaySection shifts={summary.later} onShiftPress={openShift} />
        <TomorrowPreview date={range.tomorrow} shifts={summary.tomorrow} onPress={() => setSheet('tomorrow')} />
      </>}
      {home.credentials.isError || home.notifications.isError || home.stats.isError ? <Text className="mt-4 text-xs leading-5 text-ink-soft">Some updates are unavailable. Pull down to refresh your stats, notifications, and credentials.</Text> : null}
      <Pressable onPress={() => router.push('/(tabs)/schedule')} accessibilityRole="button" className="min-h-12 flex-row items-center gap-2 py-4">
        <Ionicons name="calendar-outline" size={17} color="#4A453E" /><Text className="flex-1 text-xs text-ink-soft">See your full schedule</Text><Ionicons name="arrow-forward" size={15} color="#4A453E" />
      </Pressable>
    </ScrollView>
    {noteTarget ? <ProgressNoteSheet key={`${noteTarget.shiftId}:${noteTarget.occurrenceDate}`} target={noteTarget} onClose={() => setNoteTarget(null)} /> : null}
    {sheet ? <Dialog title={sheet === 'hours' ? 'Your week so far' : sheet === 'streak' ? 'Showing up with care' : sheet === 'attention' ? 'Needs your attention' : 'A look at tomorrow'}
      eyebrow={sheet === 'hours' ? 'This week' : sheet === 'streak' ? 'Punctuality' : sheet === 'attention' ? 'Action items' : 'Upcoming visits'} onClose={() => setSheet(null)}>
      {sheet === 'hours' ? <WeeklyHoursBreakdown weekStart={range.weekStart} weekEnd={range.weekEnd} days={summary.dailyCompletedHours}
        completedHours={hasSchedule ? summary.completedHours : null} scheduledHours={hasSchedule ? summary.scheduledHours : null}
        loading={shifts.isPending} onRetry={() => void shifts.refetch()} />
      : sheet === 'streak' ? <Text className="text-sm leading-6 text-ink-soft">{home.stats.data?.punctuality_streak != null ? `${home.stats.data.punctuality_streak} consecutive scheduled days on time.` : 'Punctuality will be available when visit check-ins are recorded. Scheduled start times alone cannot tell us whether you arrived on time.'}</Text>
      : sheet === 'attention' ? <>
        <Text className="mb-4 text-sm leading-6 text-ink-soft">Credential reminders and missing progress notes from visits completed in the last 7 days.</Text>
        <NeedsYouToday actions={attentionActions} showHeading={false} />
        {!attentionActions.length ? <Text className="text-sm text-ink-soft">No action items to show.</Text> : null}
      </>
      : <>
        <Text className="mb-4 text-sm text-ink-soft">{range.tomorrow.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</Text>
        {summary.tomorrow.map(shift => <CompactShiftRow key={`${shift.shift_id}:${shift.date}`} shift={shift} onPress={() => openShift(shift)} className="mb-3" />)}
        {!summary.tomorrow.length ? <Text className="text-sm text-ink-soft">No visits scheduled for tomorrow.</Text> : null}
      </>}
    </Dialog> : null}
  </>;
}
