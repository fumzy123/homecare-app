import { useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { useForm } from '@tanstack/react-form';
import { z } from 'zod';
import { Dialog } from '@/shared/components/Dialog';
import { Btn } from '@/shared/components/ui/Btn';
import { useUpdateMyProfile } from '../hooks/useUpdateMyProfile';
import type { WorkerProfile, WorkerProfileUpdatePayload } from '../types';
import { displayDate, humanize } from '../lib/profileView';
import { ReadOnlyDetail } from './ProfileOverview';

export type EditableProfileSection = 'personal' | 'preferences' | 'emergency';
const TITLES = { personal: 'Personal details', preferences: 'Care preferences', emergency: 'Emergency contact' };
const FIELDS = {
  personal: [ ['phone_number', 'Phone number'], ['gender', 'Gender'], ['street', 'Street address'], ['city', 'City'], ['province', 'Province'], ['postal_code', 'Postal code'] ],
  emergency: [ ['emergency_contact_name', 'Contact name'], ['emergency_contact_relationship', 'Relationship'], ['emergency_contact_phone', 'Phone number'] ],
  preferences: [ ['languages', 'Languages (separate with commas)'], ['pet_tolerance', 'Comfort around pets'] ],
} as const;

/** Layer 3: focused forms send only the fields belonging to the selected section. */
export function ProfileDetailsDialog({ profile, section, onClose }: {
  profile: WorkerProfile; section: EditableProfileSection; onClose: () => void;
}) {
  const update = useUpdateMyProfile();
  const [error, setError] = useState<string>();
  const form = useForm({
    defaultValues: {
      phone_number: profile.phone_number ?? '', gender: profile.gender ?? '', street: profile.street ?? '',
      city: profile.city ?? '', province: profile.province ?? '', postal_code: profile.postal_code ?? '',
      emergency_contact_name: profile.emergency_contact_name ?? '', emergency_contact_relationship: profile.emergency_contact_relationship ?? '',
      emergency_contact_phone: profile.emergency_contact_phone ?? '', languages: (profile.languages ?? []).join(', '),
      pet_tolerance: profile.pet_tolerance ?? '', has_vehicle: profile.has_vehicle,
    },
    onSubmit: async ({ value }) => {
      setError(undefined);
      const payload: WorkerProfileUpdatePayload = {};
      for (const [key] of FIELDS[section]) {
        if (key === 'languages') payload.languages = value.languages.split(',').map(item => item.trim()).filter(Boolean);
        else payload[key] = value[key].trim() || null;
      }
      if (section === 'preferences') payload.has_vehicle = value.has_vehicle;
      try { await update.mutateAsync(payload); onClose(); }
      catch { setError('Your changes could not be saved. Please try again.'); }
    },
  });
  const close = () => {
    if (update.isPending) return;
    if (!form.state.isDirty) return onClose();
    Alert.alert('Discard changes?', 'Your unsaved changes will be lost.', [
      { text: 'Keep editing', style: 'cancel' }, { text: 'Discard', style: 'destructive', onPress: onClose },
    ]);
  };
  return <Dialog title={TITLES[section]} eyebrow="My profile" onClose={close}>
    {section === 'personal' && <View className="mb-4 border-b border-cream-2">
      <ReadOnlyDetail label="Name" value={`${profile.first_name} ${profile.last_name}`} />
      <ReadOnlyDetail label="Email" value={profile.email} />
      <ReadOnlyDetail label="Date of birth" value={displayDate(profile.date_of_birth)} />
      <Text className="mb-4 font-sans text-xs leading-5 text-ink-soft">Contact your agency to correct your name, email or date of birth.</Text>
    </View>}
    {section === 'emergency' && <Text className="mb-5 font-sans text-sm leading-5 text-ink-soft">Who should your agency contact in an emergency?</Text>}
    {FIELDS[section].map(([key, label]) => <form.Field key={key} name={key}
      validators={{ onChange: z.string().max(key === 'pet_tolerance' ? 200 : 500, 'Please shorten this field.') }}>
      {field => <View className="mb-4 gap-2">
        <Text className="font-sans text-sm text-ink">{label}</Text>
        <TextInput value={field.state.value} onChangeText={field.handleChange} onBlur={field.handleBlur}
          editable={!update.isPending} accessibilityLabel={label} keyboardType={key.includes('phone') ? 'phone-pad' : 'default'}
          autoCapitalize={key === 'postal_code' ? 'characters' : 'sentences'}
          className="min-h-12 rounded-xl border border-cream-2 bg-white px-3 py-3 font-sans text-base text-ink" />
        {field.state.meta.errors.length > 0 && <Text accessibilityRole="alert" className="font-sans text-xs text-red-700">{field.state.meta.errors.map(item => typeof item === 'string' ? item : item?.message).join(', ')}</Text>}
      </View>}
    </form.Field>)}
    {section === 'preferences' && <>
      <form.Field name="has_vehicle">{field => <View className="mb-5">
        <Text className="mb-2 font-sans text-sm text-ink">Vehicle available for work</Text>
        <View className="flex-row flex-wrap gap-2">{[{ value: true, label: 'Yes' }, { value: false, label: 'No' }, { value: null, label: 'Not set' }].map(option =>
          <Pressable key={option.label} disabled={update.isPending} onPress={() => field.handleChange(option.value)} accessibilityRole="radio"
            accessibilityState={{ checked: field.state.value === option.value }} accessibilityLabel={option.label}
            className={`min-h-11 justify-center rounded-full border border-cream-2 px-5 ${field.state.value === option.value ? 'bg-mint' : 'bg-paper'}`}>
            <Text className="font-sans text-sm text-ink">{option.label}</Text>
          </Pressable>)}</View>
      </View>}</form.Field>
      <ReadOnlyDetail label="Client preferences" value={profile.preferred_client_types?.map(humanize).join(', ')} />
      <Text className="mb-5 font-sans text-xs leading-5 text-ink-soft">Discuss changes to client preferences with your care coordinator.</Text>
    </>}
    {error && <Text accessibilityRole="alert" className="mb-4 font-sans text-sm text-red-700">{error}</Text>}
    <form.Subscribe selector={state => [state.canSubmit, state.isDirty]}>{([canSubmit, dirty]) =>
      <Btn accessibilityRole="button" disabled={!canSubmit || !dirty || update.isPending} onPress={() => void form.handleSubmit()}>{update.isPending ? 'Saving…' : 'Save changes'}</Btn>
    }</form.Subscribe>
    <Btn accessibilityRole="button" variant="ghost" className="mt-3" disabled={update.isPending} onPress={close}>Cancel</Btn>
  </Dialog>;
}
