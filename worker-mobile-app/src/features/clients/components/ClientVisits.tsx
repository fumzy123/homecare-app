import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Btn } from '@/shared/components/ui/Btn';
import { useRecordedNotes } from '@/features/notes/hooks/useProgressNotes';
import { toDateKey } from '@/features/shifts/lib/schedule';
import { useMyClientVisits } from '../hooks/useMyClients';
import { ClientVisitCard } from './ClientVisitCard';

/** Layer 3: month-bounded queries make the entire retained history browsable. */
export function ClientVisits({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const from = toDateKey(month);
  const to = toDateKey(new Date(month.getFullYear(), month.getMonth() + 1, 0));
  const visits = useMyClientVisits(clientId, from, to);
  const notes = useRecordedNotes(from, to);
  const recorded = new Set((notes.data ?? []).map(note => `${note.shift_id}:${note.occurrence_date}`));
  const move = (amount: number) => setMonth(current => new Date(current.getFullYear(), current.getMonth() + amount, 1));

  return <>
    <Text className="text-sm leading-5 text-ink-soft">Your visits with this client. Open a shift to review the care record or add a follow-up.</Text>
    <View className="my-4 flex-row items-center justify-between rounded-full border border-cream-2 bg-paper px-1">
      <Pressable accessibilityRole="button" accessibilityLabel="Previous month" onPress={() => move(-1)} className="h-11 w-11 items-center justify-center"><Ionicons name="chevron-back" size={19} color="#111111" /></Pressable>
      <Text accessibilityRole="header" className="font-serif text-xl text-ink">{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Next month" onPress={() => move(1)} className="h-11 w-11 items-center justify-center"><Ionicons name="chevron-forward" size={19} color="#111111" /></Pressable>
    </View>
    <Pressable accessibilityRole="button" onPress={() => setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))} className="mb-3 min-h-11 justify-center self-end px-2"><Text className="text-xs font-semibold text-orange">Back to this month</Text></Pressable>
    {visits.isPending ? <ActivityIndicator accessibilityLabel="Loading visits" color="#FF5A1F" /> : visits.isError ? <>
      <Text className="mb-3 text-sm text-ink-soft">Couldn’t load these visits.</Text><Btn onPress={() => void visits.refetch()}>Try again</Btn>
    </> : visits.data.length === 0 ? <View className="rounded-2xl bg-paper p-5">
      <Text className="font-serif text-2xl text-ink">No visits this month.</Text>
      <Text className="mt-2 text-sm leading-5 text-ink-soft">Browse another month to find your earlier or upcoming visits.</Text>
    </View> : <>
      <Text className="mb-3 font-mono text-[10px] uppercase tracking-widest text-muted">{visits.data.length} visits · newest first</Text>
      {visits.data.map(visit => <ClientVisitCard key={`${visit.shift_id}:${visit.occurrence_date}`} visit={visit}
        recorded={notes.isSuccess ? recorded.has(`${visit.shift_id}:${visit.occurrence_date}`) : null}
        onPress={() => router.push({ pathname: '/shifts/[shiftId]', params: { shiftId: visit.shift_id, occurrenceDate: visit.occurrence_date, source: 'clients' } })} />)}
    </>}
  </>;
}
