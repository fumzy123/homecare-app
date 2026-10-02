import { useState } from 'react';
import { Alert, Pressable, Switch, Text, TextInput, View } from 'react-native';
import { useForm } from '@tanstack/react-form';
import { Ionicons } from '@expo/vector-icons';
import { Dialog } from '@/shared/components/Dialog';
import { Btn } from '@/shared/components/ui/Btn';
import { availabilityError, dayEntries, WEEK_DAYS } from '../lib/profileView';
import type { AvailabilityEntry } from '../types';
import { useUpdateAvailability } from '../hooks/useUpdateAvailability';

export function AvailabilityDialog({ entries, onClose }: { entries: AvailabilityEntry[]; onClose: () => void }) {
  const update = useUpdateAvailability();
  const [error, setError] = useState<string>();
  const form = useForm({
    defaultValues: { days: WEEK_DAYS.map(day => ({
      ...day, enabled: dayEntries(entries, day.key).length > 0,
      windows: dayEntries(entries, day.key).map(entry => ({ start_time: entry.start_time.slice(0, 5), end_time: entry.end_time.slice(0, 5) })),
    })) },
    onSubmit: async ({ value }) => {
      const next = value.days.flatMap(day => day.enabled ? day.windows.map(window => ({ ...window, day_of_week: day.key })) : []);
      const validation = availabilityError(next);
      setError(validation);
      if (validation) return;
      try { await update.mutateAsync(next); onClose(); }
      catch { setError('Availability could not be saved. Your changes are still here; please try again.'); }
    },
  });
  const close = () => {
    if (update.isPending) return;
    if (!form.state.isDirty) return onClose();
    Alert.alert('Discard availability changes?', 'Your unsaved changes will be lost.', [
      { text: 'Keep editing', style: 'cancel' }, { text: 'Discard', style: 'destructive', onPress: onClose },
    ]);
  };
  return <Dialog title="Your availability" eyebrow="My working week" onClose={close}>
    <Text className="mb-5 font-sans text-sm leading-5 text-ink-soft">Set your hours for each day. Use 24-hour times: 08:00 is 8 AM, 17:00 is 5 PM. Changes do not alter visits already scheduled.</Text>
    <form.Field name="days">{field => field.state.value.map((day, index) => {
      const changeDay = (next: typeof day) => field.handleChange(field.state.value.map((item, i) => i === index ? next : item));
      return <View key={day.key} className="mb-4 border-b border-cream-2 pb-4">
        <View className="flex-row items-center justify-between gap-3">
          <Text className="font-sans text-base font-semibold text-ink">{day.label}</Text>
          <Switch disabled={update.isPending} accessibilityLabel={`${day.label} available`} value={day.enabled} trackColor={{ true: '#4FB6A2' }}
            onValueChange={enabled => changeDay({ ...day, enabled, windows: day.windows.length ? day.windows : [{ start_time: '08:00', end_time: '17:00' }] })} />
        </View>
        {!day.enabled && <Text className="font-sans text-xs text-ink-soft">Not available</Text>}
        {day.enabled && <>{day.windows.map((window, windowIndex) => <View key={windowIndex} className="mt-3 flex-row items-end gap-2">
          {(['start_time', 'end_time'] as const).map((key, timeIndex) => <View key={key} className="flex-1 gap-1">
            <Text className="font-sans text-xs text-ink-soft">{timeIndex ? 'End' : 'Start'}</Text>
            <TextInput accessibilityLabel={`${day.label}, window ${windowIndex + 1}, ${timeIndex ? 'end' : 'start'} time in 24-hour format`}
              value={window[key]} placeholder="HH:MM" maxLength={5} autoCorrect={false} editable={!update.isPending}
              onChangeText={time => changeDay({ ...day, windows: day.windows.map((item, i) => i === windowIndex ? { ...item, [key]: time } : item) })}
              className="min-h-12 rounded-xl border border-cream-2 bg-white px-3 font-sans text-base text-ink" />
          </View>)}
          {day.windows.length > 1 && <Pressable disabled={update.isPending} accessibilityRole="button" accessibilityLabel={`Remove ${day.label} window ${windowIndex + 1}`}
            className="h-12 w-11 items-center justify-center" onPress={() => changeDay({ ...day, windows: day.windows.filter((_, i) => i !== windowIndex) })}>
            <Ionicons name="close-circle-outline" size={22} color="#4A453E" />
          </Pressable>}
        </View>)}
        <Pressable disabled={update.isPending} accessibilityRole="button" accessibilityLabel={`Add another time for ${day.label}`}
          className="min-h-11 justify-center self-start" onPress={() => changeDay({ ...day, windows: [...day.windows, { start_time: '', end_time: '' }] })}>
          <Text className="font-sans text-sm text-ink underline">+ Add another time</Text>
        </Pressable></>}
      </View>;
    })}</form.Field>
    {error && <Text accessibilityRole="alert" className="mb-4 font-sans text-sm text-red-700">{error}</Text>}
    <form.Subscribe selector={state => state.isDirty}>{dirty => <Btn accessibilityRole="button" disabled={!dirty || update.isPending} onPress={() => void form.handleSubmit()}>{update.isPending ? 'Saving…' : 'Save availability'}</Btn>}</form.Subscribe>
    <Btn accessibilityRole="button" variant="ghost" className="mt-3" disabled={update.isPending} onPress={close}>Cancel</Btn>
  </Dialog>;
}
