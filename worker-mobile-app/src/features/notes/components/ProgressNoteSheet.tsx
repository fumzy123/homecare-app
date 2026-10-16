import { useState } from 'react';
import { ActivityIndicator, Alert, Keyboard, Text, TextInput, View } from 'react-native';
import { useForm } from '@tanstack/react-form';
import { isAxiosError } from 'axios';
import { z } from 'zod';
import { BottomSheet } from '@/shared/components/BottomSheet';
import { Btn } from '@/shared/components/ui/Btn';
import { useAddProgressNote, useProgressNote } from '../hooks/useProgressNotes';
import type { NoteEntry, ProgressNote } from '../api';
import { SavedNoteEntry, noteEntryLabel } from './SavedNoteEntry';

export interface NoteTarget { shiftId: string; occurrenceDate: string; clientName: string }
interface Props { target: NoteTarget; onClose: () => void }

export function ProgressNoteSheet({ target, onClose }: Props) {
  const query = useProgressNote(target.shiftId, target.occurrenceDate);
  // Keep the editor mounted after a failed background refresh so drafts survive.
  if (query.data === undefined) {
    return <BottomSheet title="Progress note" subtitle={target.clientName} onClose={onClose}>
      {query.isPending ? <ActivityIndicator accessibilityLabel="Loading progress note" color="#FF5A1F" /> : <>
        <Text className="mb-4 text-sm text-ink-soft">Could not load this visit’s notes. Your access or connection may have changed.</Text>
        <Btn onPress={() => void query.refetch()}>Try again</Btn>
      </>}
    </BottomSheet>;
  }
  return <NoteEditor target={target} note={query.data} loadError={query.isError} onClose={onClose} onReload={() => void query.refetch()} />;
}

function NoteEditor({ target, note, loadError, onClose, onReload }: Props & { note: ProgressNote | null; loadError: boolean; onReload: () => void }) {
  const mutation = useAddProgressNote(target.shiftId, target.occurrenceDate);
  const [reading, setReading] = useState<{ entry: NoteEntry; index: number } | null>(null);
  const form = useForm({
    defaultValues: { content: '' },
    onSubmit: async ({ value }) => {
      const now = new Date();
      try {
        await mutation.mutateAsync({
          occurrence_date: target.occurrenceDate,
          expected_entry_count: note?.entries.length ?? 0,
          time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
          content: value.content.trim(),
        });
        Keyboard.dismiss();
        onClose();
        Alert.alert('Progress note saved', 'Your entry has been added to this visit’s record.');
      } catch { /* Keep the unsaved text available; the error is rendered below. */ }
    },
  });
  function close() {
    if (mutation.isPending) return;
    if (!form.state.values.content.trim()) return onClose();
    Alert.alert('Discard this entry?', 'Your unsaved text will be lost.', [
      { text: 'Keep writing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: onClose },
    ]);
  }
  const errorCode = isAxiosError(mutation.error) ? mutation.error.response?.data?.error?.code : undefined;
  if (reading) return <BottomSheet fullScreen title={noteEntryLabel(reading.index)}
    subtitle={`${target.clientName} · ${target.occurrenceDate}`} closeLabel="Back to progress notes" onClose={() => setReading(null)}>
    <Text className="mb-4 font-mono text-sm text-ink-soft">Saved entry · {reading.entry.time}</Text>
    <Text selectable className="font-sans text-base leading-7 text-ink">{reading.entry.content}</Text>
  </BottomSheet>;
  const entryCount = note?.entries.length ?? 0;
  return <BottomSheet title="Progress note" subtitle={`${target.clientName} · ${target.occurrenceDate}`} onClose={close}>
    {loadError ? <View className="mb-3 rounded-xl bg-orange-soft p-3">
      <Text accessibilityRole="alert" className="text-sm text-ink">Could not refresh the saved entries. Your unsaved text is still here.</Text>
      <Btn variant="ghost" className="mt-2" onPress={onReload}>Try loading again</Btn>
    </View> : null}
    <Text accessibilityRole="header" className="mb-3 font-sans text-base font-semibold text-ink">Saved notes · {entryCount} {entryCount === 1 ? 'entry' : 'entries'}</Text>
    {entryCount === 0 ? <Text className="mb-4 text-sm text-ink-soft">No notes have been saved for this visit yet.</Text> : null}
    {note?.entries.map((entry, index) => <SavedNoteEntry key={index} entry={entry} index={index} onRead={() => {
      Keyboard.dismiss();
      setReading({ entry, index });
    }} />)}
    <View className="mt-3 border-t border-ink-soft pt-5">
    <Text accessibilityRole="header" className="mb-2 font-serif text-2xl text-ink">{entryCount ? 'Add a follow-up' : 'Write a progress note'}</Text>
    <Text className="mb-3 text-sm leading-5 text-ink-soft">{entryCount ? 'Add more detail or clarify an earlier entry. Saved notes stay unchanged.' : 'Record the care provided and your observations from this visit.'}</Text>
    <form.Field name="content" validators={{ onChange: z.string().trim().min(1, 'Enter a progress note.').max(10000, 'Keep this entry under 10,000 characters.') }}>
      {field => <>
        <TextInput
          accessibilityLabel="Progress note entry" placeholder="Care provided and observations…" placeholderTextColor="#8A8378"
          value={field.state.value} onChangeText={field.handleChange} onBlur={field.handleBlur}
          multiline textAlignVertical="top" maxLength={10000} editable={!mutation.isPending}
          className="min-h-40 rounded-xl border border-ink-soft bg-cream p-4 text-base text-ink"
        />
        {field.state.meta.isTouched && field.state.meta.errors.length > 0 ? <Text accessibilityRole="alert" className="mt-2 text-sm text-ink-soft">Enter a note of 1–10,000 characters.</Text> : null}
      </>}
    </form.Field>
    {mutation.isError ? <View className="mt-3 rounded-xl bg-orange-soft p-3">
      <Text accessibilityRole="alert" className="text-sm text-ink">{errorCode === 'NOTE_CHANGED'
        ? 'This record changed. Load the latest entries and review them before saving again.'
        : 'Could not confirm the save. Your text is still here. Check the latest entries before retrying.'}</Text>
      <Btn variant="ghost" className="mt-3" onPress={onReload}>Load latest entries</Btn>
    </View> : null}
    <form.Subscribe selector={state => [state.canSubmit, state.values.content] as const}>
      {([canSubmit, content]) => <Btn className="mt-4" disabled={!canSubmit || !content.trim() || mutation.isPending || loadError} onPress={() => void form.handleSubmit()}>
        {mutation.isPending ? 'Saving…' : entryCount ? 'Save follow-up' : 'Save progress note'}
      </Btn>}
    </form.Subscribe>
    </View>
  </BottomSheet>;
}
