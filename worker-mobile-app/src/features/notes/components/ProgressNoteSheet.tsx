import { ActivityIndicator, Alert, Text, TextInput, View } from 'react-native';
import { useForm } from '@tanstack/react-form';
import { isAxiosError } from 'axios';
import { z } from 'zod';
import { BottomSheet } from '@/shared/components/BottomSheet';
import { Btn } from '@/shared/components/ui/Btn';
import { useAddProgressNote, useProgressNote } from '../hooks/useProgressNotes';
import type { ProgressNote } from '../api';

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
        onClose();
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
  return <BottomSheet title="Progress note" subtitle={`${target.clientName} · ${target.occurrenceDate}`} onClose={close}>
    {loadError ? <View className="mb-3 rounded-xl bg-orange-soft p-3">
      <Text accessibilityRole="alert" className="text-sm text-ink">Could not refresh the saved entries. Your unsaved text is still here.</Text>
      <Btn variant="ghost" className="mt-2" onPress={onReload}>Try loading again</Btn>
    </View> : null}
    {note?.entries.map((entry, index) => <View key={index} className="mb-3 rounded-xl bg-cream p-3">
      <Text className="font-mono text-xs text-ink-soft">{entry.time}</Text>
      <Text className="mt-1 text-sm leading-5 text-ink">{entry.content}</Text>
    </View>)}
    <Text className="mb-3 text-sm text-ink-soft">Record the care provided and your observations. New entries are added to the visit’s existing record.</Text>
    <form.Field name="content" validators={{ onChange: z.string().trim().min(1, 'Enter a progress note.').max(10000, 'Keep this entry under 10,000 characters.') }}>
      {field => <>
        <TextInput
          accessibilityLabel="Progress note entry" placeholder="Care provided and observations…" placeholderTextColor="#8A8378"
          value={field.state.value} onChangeText={field.handleChange} onBlur={field.handleBlur}
          multiline textAlignVertical="top" maxLength={10000} editable={!mutation.isPending}
          className="min-h-40 rounded-xl border border-cream-2 bg-cream p-4 text-base text-ink"
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
        {mutation.isPending ? 'Saving…' : 'Save progress note'}
      </Btn>}
    </form.Subscribe>
  </BottomSheet>;
}
