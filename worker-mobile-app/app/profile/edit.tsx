import { useState } from 'react';
import {
  View, Text, TextInput, ScrollView, Pressable,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useWorkerProfile } from '@/features/profile/hooks/useWorkerProfile';
import { useUpdateMyProfile } from '@/features/profile/hooks/useUpdateMyProfile';
import { useMyCredentials } from '@/features/profile/hooks/useMyCredentials';
import { SectionDivider } from '@/features/profile/components/SectionDivider';
import { Avatar } from '@/shared/components/ui';
import { getInitials } from '@/shared/utils/getInitials';
import type { WorkerProfileUpdatePayload } from '@/features/profile/types';
import { DOCUMENT_TYPE_LABELS } from '@/features/profile/types';

const LANGUAGE_OPTIONS = [
  'English', 'French', 'Spanish', 'Tagalog', 'Mandarin', 'Cantonese',
  'Punjabi', 'Hindi', 'Arabic', 'Portuguese', 'Italian', 'Greek',
  'Vietnamese', 'Korean', 'Wolof',
];

const GENDER_OPTIONS = ['Female', 'Male', 'Non-binary', 'Prefer not to say'];

const EMPLOYMENT_STATUS_LABELS: Record<string, string> = {
  active: 'Active', on_leave: 'On Leave', terminated: 'Terminated',
};
const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  full_time: 'Full-time', part_time: 'Part-time', casual: 'Casual', contract: 'Contract',
};
const ROLE_LABELS: Record<string, string> = {
  home_support_worker: 'Home Support Worker', nurse: 'Nurse',
  owner: 'Owner', agency_admin: 'Agency Admin',
};

// ── Primitives ────────────────────────────────────────────────────────────────

function EField({
  label, value, onChangeText, keyboardType, placeholder,
  autoCapitalize, multiline, hint,
}: {
  label: string; value: string; onChangeText: (t: string) => void;
  keyboardType?: 'default' | 'phone-pad' | 'numeric' | 'email-address';
  placeholder?: string; autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  multiline?: boolean; hint?: string;
}) {
  return (
    <View className="mb-3.5">
      <Text className="mb-1.5 font-mono text-[9.5px] uppercase tracking-[0.1em] text-ink-soft">
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType ?? 'default'}
        autoCapitalize={autoCapitalize ?? 'sentences'}
        placeholder={placeholder ?? ''}
        placeholderTextColor="#8A8378"
        multiline={multiline}
        numberOfLines={multiline ? 2 : 1}
        className="border border-ink bg-paper px-3 py-[11px] font-mono text-[13px] text-ink"
        style={multiline ? { minHeight: 56, textAlignVertical: 'top' } : undefined}
      />
      {hint && (
        <Text className="mt-1 font-mono text-[8.5px] text-muted">{hint}</Text>
      )}
    </View>
  );
}

function ESelect({
  label, value, options, onSelect,
}: {
  label: string; value: string | null; options: string[]; onSelect: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View className="mb-3.5">
      <Text className="mb-1.5 font-mono text-[9.5px] uppercase tracking-[0.1em] text-ink-soft">
        {label}
      </Text>
      <Pressable
        onPress={() => setOpen(!open)}
        className="flex-row items-center justify-between border border-ink bg-paper px-3 py-[11px]"
      >
        <Text className="font-mono text-[13px] text-ink">{value ?? 'Select…'}</Text>
        <Text className="font-mono text-[9px] text-ink-soft">{open ? '▲' : '▼'}</Text>
      </Pressable>
      {open && (
        <View className="border-x border-b border-ink">
          {options.map((opt, i) => (
            <Pressable
              key={opt}
              onPress={() => { onSelect(opt); setOpen(false); }}
              className={`flex-row items-center justify-between px-3 py-2.5 ${
                i < options.length - 1 ? 'border-b border-ink/[0.08]' : ''
              } ${value === opt ? 'bg-ink' : 'bg-paper'}`}
            >
              <Text className={`text-[13px] ${value === opt ? 'text-cream' : 'text-ink'}`}>
                {opt}
              </Text>
              {value === opt && (
                <Text className="font-mono text-[10px] text-cream">✓</Text>
              )}
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

function EChips({
  label, items, allOptions, onAdd, onRemove,
}: {
  label: string; items: string[]; allOptions: string[];
  onAdd: (opt: string) => void; onRemove: (opt: string) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const remaining = allOptions.filter((o) => !items.includes(o));

  return (
    <View className="mb-3.5">
      <Text className="mb-1.5 font-mono text-[9.5px] uppercase tracking-[0.1em] text-ink-soft">
        {label}
      </Text>
      <View className="flex-row flex-wrap gap-1.5">
        {items.map((item) => (
          <Pressable
            key={item}
            onPress={() => onRemove(item)}
            className="flex-row items-center gap-1.5 rounded-sm border border-lavender bg-lavender px-2.5 py-1"
          >
            <Text className="font-mono text-[10px] uppercase tracking-wider text-ink">
              {item}
            </Text>
            <Text className="font-mono text-[11px] text-ink" style={{ opacity: 0.5 }}>×</Text>
          </Pressable>
        ))}
        <Pressable
          onPress={() => setPickerOpen(!pickerOpen)}
          className="rounded-sm border border-dashed border-ink px-2.5 py-1"
        >
          <Text className="font-mono text-[10px] uppercase tracking-wider text-ink">
            ＋ ADD
          </Text>
        </Pressable>
      </View>
      {pickerOpen && remaining.length > 0 && (
        <View className="mt-2 flex-row flex-wrap gap-1.5 border-t border-ink/10 pt-2">
          {remaining.map((opt) => (
            <Pressable
              key={opt}
              onPress={() => onAdd(opt)}
              className="rounded-sm border border-ink/30 bg-paper px-2.5 py-1"
            >
              <Text className="font-mono text-[10px] uppercase tracking-wider text-ink-soft">
                {opt}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

function LockedField({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-baseline justify-between gap-4 border-b border-ink/[0.08] py-[9px]">
      <Text className="flex-shrink-0 font-mono text-[9px] uppercase tracking-[0.09em] text-muted">
        {label}
      </Text>
      <Text className="text-right font-mono text-[11px] font-medium text-muted">
        {value}{'  '}🔒
      </Text>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function EditProfileScreen() {
  const { data: profile } = useWorkerProfile();
  const { data: credentials = [] } = useMyCredentials();
  const { mutate: save, isPending: saving, error } = useUpdateMyProfile();

  const [form, setForm] = useState(() => ({
    phone_number: profile?.phone_number ?? '',
    gender: profile?.gender ?? null as string | null,
    street: profile?.street ?? '',
    city: profile?.city ?? '',
    province: profile?.province ?? '',
    postal_code: profile?.postal_code ?? '',
    languages: profile?.languages ?? [] as string[],
    emergency_contact_name: profile?.emergency_contact_name ?? '',
    emergency_contact_phone: profile?.emergency_contact_phone ?? '',
    emergency_contact_relationship: profile?.emergency_contact_relationship ?? '',
  }));

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function addLanguage(lang: string) {
    setForm((f) => ({ ...f, languages: [...f.languages, lang] }));
  }

  function removeLanguage(lang: string) {
    setForm((f) => ({ ...f, languages: f.languages.filter((l) => l !== lang) }));
  }

  function handleSave() {
    const payload: WorkerProfileUpdatePayload = {
      phone_number: form.phone_number || null,
      gender: form.gender,
      street: form.street || null,
      city: form.city || null,
      province: form.province || null,
      postal_code: form.postal_code || null,
      languages: form.languages.length > 0 ? form.languages : null,
      emergency_contact_name: form.emergency_contact_name || null,
      emergency_contact_phone: form.emergency_contact_phone || null,
      emergency_contact_relationship: form.emergency_contact_relationship || null,
    };
    save(payload, { onSuccess: () => router.back() });
  }

  const initials = profile ? getInitials(profile.first_name, profile.last_name) : '?';

  return (
    <SafeAreaView className="flex-1 bg-cream">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* ── Sticky header ────────────────────────────────────────────── */}
        <View className="flex-row items-center justify-between border-b border-ink bg-cream px-5 py-4">
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text className="font-mono text-[11px] text-ink underline">Cancel</Text>
          </Pressable>
          <View className="flex-row items-center gap-2">
            <View className="h-px w-3 bg-ink" />
            <Text className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-soft">
              Edit Profile
            </Text>
          </View>
          <Pressable onPress={handleSave} disabled={saving} hitSlop={12}>
            {saving ? (
              <ActivityIndicator size="small" color="#FF5A1F" />
            ) : (
              <Text className="font-mono text-[11px] font-bold text-orange">Save</Text>
            )}
          </Pressable>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 48 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Intro note ───────────────────────────────────────────────── */}
          <View className="px-5 pt-3 pb-1">
            <Text className="font-mono text-[9.5px] leading-relaxed tracking-[0.01em] text-ink-soft">
              You control your contact details, emergency contact, and account settings.
              Employment, pay, availability and credential verification are managed by your agency.
            </Text>
          </View>

          {/* ── Photo ────────────────────────────────────────────────────── */}
          <SectionDivider label="Photo" />
          <View className="flex-row items-center gap-4 px-5 pb-2 pt-1">
            <Avatar initials={initials} size="xl" className="bg-orange" />
            <View className="gap-2">
              <Pressable className="border border-ink bg-paper px-3.5 py-2">
                <Text className="font-mono text-[10px] uppercase tracking-[0.04em] text-ink">
                  ↤ Change Photo
                </Text>
              </Pressable>
              <Pressable>
                <Text className="font-mono text-[9.5px] text-ink-soft underline">
                  Remove photo
                </Text>
              </Pressable>
            </View>
          </View>

          {/* ── Personal & Contact ───────────────────────────────────────── */}
          <SectionDivider label="Personal & Contact" />
          <View className="px-5">
            {error && (
              <View className="mb-3 border border-orange bg-orange-soft px-3 py-2">
                <Text className="font-mono text-[10px] text-orange">
                  Failed to save — please try again.
                </Text>
              </View>
            )}
            <EField
              label="Email"
              value={profile?.email ?? ''}
              onChangeText={() => {}}
              keyboardType="email-address"
              autoCapitalize="none"
              hint="Contact your coordinator to change your email."
            />
            <EField
              label="Phone"
              value={form.phone_number}
              onChangeText={(t) => set('phone_number', t)}
              keyboardType="phone-pad"
              autoCapitalize="none"
            />
            <EField
              label="Street address"
              value={form.street}
              onChangeText={(t) => set('street', t)}
              autoCapitalize="words"
            />
            <View className="flex-row gap-3">
              <View className="flex-1">
                <EField
                  label="City"
                  value={form.city}
                  onChangeText={(t) => set('city', t)}
                  autoCapitalize="words"
                />
              </View>
              <View style={{ width: 72 }}>
                <EField
                  label="Province"
                  value={form.province}
                  onChangeText={(t) => set('province', t.toUpperCase())}
                  autoCapitalize="characters"
                  placeholder="ON"
                />
              </View>
            </View>
            <EField
              label="Postal code"
              value={form.postal_code}
              onChangeText={(t) => set('postal_code', t.toUpperCase())}
              autoCapitalize="characters"
              placeholder="A1A 1A1"
            />
            <ESelect
              label="Gender"
              value={form.gender}
              options={GENDER_OPTIONS}
              onSelect={(v) => set('gender', v)}
            />
            <EChips
              label="Languages spoken"
              items={form.languages}
              allOptions={LANGUAGE_OPTIONS}
              onAdd={addLanguage}
              onRemove={removeLanguage}
            />
            <LockedField label="Legal name" value={`${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`} />
            <LockedField label="Date of birth" value={profile?.date_of_birth ?? '—'} />
          </View>

          {/* ── Emergency Contact ────────────────────────────────────────── */}
          <SectionDivider label="Emergency Contact" />
          <View className="px-5">
            <EField
              label="Contact name"
              value={form.emergency_contact_name}
              onChangeText={(t) => set('emergency_contact_name', t)}
              autoCapitalize="words"
            />
            <EField
              label="Relationship"
              value={form.emergency_contact_relationship}
              onChangeText={(t) => set('emergency_contact_relationship', t)}
              autoCapitalize="words"
              placeholder="e.g. Sister, Spouse"
            />
            <EField
              label="Phone"
              value={form.emergency_contact_phone}
              onChangeText={(t) => set('emergency_contact_phone', t)}
              keyboardType="phone-pad"
              autoCapitalize="none"
            />
          </View>

          {/* ── My Documents ─────────────────────────────────────────────── */}
          <SectionDivider label="My Documents" />
          <View className="px-5">
            <Text className="mb-2.5 font-mono text-[9px] leading-relaxed text-ink-soft">
              You can upload or replace documents. Issuer, dates and verification status are set by your agency after review.
            </Text>
            <View className="gap-2">
              {credentials.map((c) => (
                <View
                  key={c.id}
                  className="flex-row items-center gap-3 border border-ink bg-paper p-3"
                >
                  {/* Paper doc glyph */}
                  <View style={{
                    width: 26, height: 32, backgroundColor: '#EDE8DC',
                    borderWidth: 1, borderColor: '#111111', flexShrink: 0, position: 'relative',
                  }}>
                    <View style={{
                      position: 'absolute', top: -1, right: -1,
                      width: 8, height: 8, backgroundColor: '#F2EEE5',
                      borderLeftWidth: 1, borderBottomWidth: 1, borderColor: '#111111',
                    }} />
                  </View>
                  <View className="min-w-0 flex-1">
                    <Text className="text-[12.5px] font-semibold text-ink">{DOCUMENT_TYPE_LABELS[c.document_type]}</Text>
                    <Text
                      className="mt-1 font-mono text-[9px]"
                      style={{ color: c.file_url ? '#4A453E' : '#FF5A1F' }}
                    >
                      {c.file_url ? 'DOCUMENT ON FILE' : 'NOT UPLOADED'}
                    </Text>
                  </View>
                  <Pressable
                    style={{
                      paddingVertical: 7, paddingHorizontal: 11, flexShrink: 0,
                      borderWidth: 1,
                      borderColor: c.file_url ? '#111111' : '#FF5A1F',
                      backgroundColor: c.file_url ? '#F8F5EC' : '#FF5A1F',
                    }}
                  >
                    <Text
                      className="font-mono text-[9px] uppercase tracking-wider"
                      style={{ color: c.file_url ? '#111111' : 'white' }}
                    >
                      {c.file_url ? 'Replace' : '↤ Upload'}
                    </Text>
                  </Pressable>
                </View>
              ))}
              {credentials.length === 0 && (
                <Text className="py-3 text-center font-mono text-[10px] text-muted">
                  No credentials on file.
                </Text>
              )}
            </View>
          </View>

          {/* ── Managed by your agency ───────────────────────────────────── */}
          <SectionDivider label="Managed by Your Agency" />
          <View className="px-5">
            <Text className="mb-2 font-mono text-[9px] leading-relaxed text-ink-soft">
              To change any of these, contact your coordinator.
            </Text>
            <LockedField
              label="Employment status"
              value={EMPLOYMENT_STATUS_LABELS[profile?.employment_status ?? ''] ?? '—'}
            />
            <LockedField
              label="Employment type"
              value={profile?.employment_type
                ? EMPLOYMENT_TYPE_LABELS[profile.employment_type] ?? profile.employment_type
                : '—'}
            />
            <LockedField
              label="Role"
              value={ROLE_LABELS[profile?.role ?? ''] ?? profile?.role ?? '—'}
            />
            <LockedField
              label="Pay rate"
              value={profile?.pay_rate ? `$${parseFloat(profile.pay_rate).toFixed(2)}/h` : '—'}
            />
            <LockedField
              label="Max hours / week"
              value={profile?.max_hours_per_week ? `${profile.max_hours_per_week} h` : '—'}
            />
            <LockedField label="Shift & client prefs" value="Set with coordinator" />
          </View>

          {/* ── Footer ───────────────────────────────────────────────────── */}
          <View className="mx-5 mt-6 gap-3">
            <Pressable
              onPress={handleSave}
              disabled={saving}
              className="items-center rounded-full bg-orange py-3.5"
            >
              {saving ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="font-mono text-[13px] font-medium tracking-[0.04em] text-white">
                  Save changes
                </Text>
              )}
            </Pressable>
            <Pressable onPress={() => router.back()} className="items-center py-2">
              <Text className="font-mono text-[10px] text-ink-soft underline">
                Discard &amp; go back
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
