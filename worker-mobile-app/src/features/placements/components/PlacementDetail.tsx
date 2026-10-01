import { useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import { usePlacement, useExpressInterest, useWithdrawInterest } from '../hooks/usePlacement';

const dayNames: Record<string, string> = { MO: 'Monday', TU: 'Tuesday', WE: 'Wednesday', TH: 'Thursday', FR: 'Friday', SA: 'Saturday', SU: 'Sunday' };

export function PlacementDetail({ placementId }: { placementId: string }) {
  const query = usePlacement(placementId);
  const express = useExpressInterest(placementId);
  const withdraw = useWithdrawInterest(placementId);
  const [selected, setSelected] = useState<string[]>(() => query.data?.interested_care_slot_ids ?? []);
  const [seededFrom, setSeededFrom] = useState(query.data);
  const [note, setNote] = useState(() => query.data?.interest_note ?? '');
  const [error, setError] = useState('');
  if (query.data !== seededFrom) { setSeededFrom(query.data); setSelected(query.data?.interested_care_slot_ids ?? []); setNote(query.data?.interest_note ?? ''); }
  if (query.isPending) return <ActivityIndicator color="#FF5A1F" />;
  if (query.isError || !query.data) return <View className="p-6"><Text>Could not load placement.</Text><Pressable onPress={() => void query.refetch()}><Text>Retry</Text></Pressable></View>;
  const p = query.data;
  const open = p.status === 'open';
  const available = p.care_slots.filter(slot => slot.id && !slot.worker_id);
  const chosen = selected.filter(id => available.some(slot => slot.id === id));
  const busy = express.isPending || withdraw.isPending;
  function toggle(id: string) { setSelected(prev => prev.includes(id) ? prev.filter(value => value !== id) : [...prev, id]); }
  return <ScrollView className="flex-1 bg-cream" contentContainerStyle={{ padding: 20, paddingBottom: 48 }}>
    <Text className="font-mono text-xs uppercase text-muted">Weekly Care Need</Text>
    <Text accessibilityRole="header" className="mt-3 font-serif text-3xl text-ink">{p.client_first_name} {p.client_last_name}</Text>
    <Text className="mt-3 text-sm text-ink">{p.masked_location}</Text>
    <Text className="mt-2 font-mono text-xs text-ink-soft">Starts {p.scheduled_from ?? p.start_date} · {p.status === 'filled' ? 'Fully covered' : p.status}</Text>
    {p.requirements ? <Text className="mt-4 text-sm text-ink">{p.requirements}</Text> : null}
    <Text className="mt-6 mb-3 font-serif text-2xl text-ink">Care Slots</Text>
    {open && available.length > 0 ? <Pressable accessibilityRole="button" disabled={busy} className="min-h-11 justify-center mb-2" onPress={() => setSelected(available.map(slot => slot.id))}><Text className="underline text-ink">Select all available Care Slots</Text></Pressable> : null}
    {p.care_slots.map((slot, index) => <Pressable key={slot.id || index} accessibilityRole="checkbox" accessibilityState={{ checked: chosen.includes(slot.id), disabled: !open || !!slot.worker_id || !slot.id || busy }}
      disabled={!open || !!slot.worker_id || !slot.id || busy} onPress={() => toggle(slot.id)}
      className={`mb-3 rounded-xl border border-ink p-4 ${chosen.includes(slot.id) ? 'bg-mint-soft' : 'bg-paper'}`}>
      <Text className="font-sans font-semibold text-ink">{chosen.includes(slot.id) ? '✓ ' : ''}{dayNames[slot.day_of_week] ?? slot.day_of_week} · {slot.start_time.slice(0, 5)}–{slot.end_time.slice(0, 5)}</Text>
      <Text className="mt-1 text-sm text-ink-soft">{slot.service_type.replaceAll('_', ' ')}</Text>
      <Text className="mt-2 text-sm text-ink">{slot.worker_name ? `Approved · ${slot.worker_name}` : 'Available'}</Text>
    </Pressable>)}
    {!p.care_slots.some(slot => slot.id) && <Text className="mt-2 text-ink-soft">This earlier placement needs to be reposted by your agency.</Text>}
    {p.has_interest && open ? <Text className="mt-4 text-sm text-ink">Interest sent. Your agency will review your selected Care Slots.</Text> : null}
    {open && available.length > 0 ? <View className="mt-4">
      <Text className="mb-3 text-sm text-ink-soft">Expressing interest does not reserve a Care Slot. Your agency approves assignments.</Text>
      <TextInput accessibilityLabel="Optional note to your agency" multiline value={note} onChangeText={setNote} placeholder="Add a note (optional)" className="min-h-20 rounded-xl border border-ink bg-paper p-3 text-ink" />
      <Pressable accessibilityRole="button" disabled={busy || chosen.length === 0} className={`mt-4 min-h-12 items-center justify-center rounded-full bg-ink px-4 py-3 ${busy || !chosen.length ? 'opacity-40' : ''}`} onPress={() => { setError(''); express.mutate({ careSlotIds: chosen, note }, { onError: () => setError('Could not save your interest. A Care Slot may have been filled; refresh and try again.') }); }}>
        <Text className="font-mono text-sm text-cream">{express.isPending ? 'Sending…' : `Express interest in ${chosen.length} Care Slot${chosen.length === 1 ? '' : 's'}`}</Text>
      </Pressable>
    </View> : null}
    {p.has_interest && open ? <Pressable accessibilityRole="button" disabled={busy} className="mt-4 min-h-11 items-center justify-center" onPress={() => withdraw.mutate(undefined, { onError: () => setError('Could not withdraw interest.') })}><Text className="underline text-ink">Withdraw interest</Text></Pressable> : null}
    {error ? <Text accessibilityRole="alert" className="mt-3 text-orange">{error}</Text> : null}
  </ScrollView>;
}
