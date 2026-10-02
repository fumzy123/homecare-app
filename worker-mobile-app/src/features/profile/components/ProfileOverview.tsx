import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import type { ComponentProps } from 'react';
import type { AvailabilityEntry, WeekDay, WorkerProfile } from '../types';
import { dayEntries, formatTime, WEEK_DAYS } from '../lib/profileView';

/** Layer 2: profile identity and a single, clearly associated edit entry. */
export function ProfileIdentity({ profile, onOpen }: { profile: WorkerProfile; onOpen: () => void }) {
  return <View className="mb-7 flex-row items-start gap-4">
    <View className="h-20 w-20 items-center justify-center rounded-full bg-cream-2">
      <Text className="font-serif text-4xl text-ink">{profile.first_name[0]}{profile.last_name[0]}</Text>
    </View>
    <View className="min-w-0 flex-1">
      <Text className="font-serif text-3xl leading-9 text-ink">{profile.first_name} <Text className="font-serif-italic">{profile.last_name}</Text></Text>
      <Text className="mt-1 font-sans text-sm text-ink-soft">Home support worker</Text>
      <Text className="mt-1 font-sans text-sm text-ink-soft">{profile.agency_name}</Text>
      <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel="View profile and edit personal details"
        className="mt-1 min-h-11 flex-row items-center self-start gap-2 pr-4">
        <Text className="font-sans text-sm font-semibold text-ink underline">View profile</Text>
        <Ionicons name="arrow-up-outline" size={16} color="#111" style={{ transform: [{ rotate: '45deg' }] }} />
      </Pressable>
    </View>
  </View>;
}

export function WorkingWeek({ entries, selected, onSelect, cap, onEdit }: {
  entries: AvailabilityEntry[]; selected: WeekDay; onSelect: (day: WeekDay) => void; cap: number | null; onEdit: () => void;
}) {
  const windows = dayEntries(entries, selected);
  return <View className="mb-8 rounded-3xl bg-ink p-5">
    <View className="mb-5 flex-row items-center justify-between gap-2">
      <Text className="flex-1 font-serif text-3xl text-paper">My working week</Text>
      <Ionicons name="calendar-outline" size={21} color="#9DE8DC" />
    </View>
    <View className="flex-row gap-1">
      {WEEK_DAYS.map(day => {
        const available = dayEntries(entries, day.key).length > 0;
        return <Pressable key={day.key} onPress={() => onSelect(day.key)} accessibilityRole="button"
          accessibilityLabel={`${day.label}, ${available ? 'available' : 'unavailable'}`} accessibilityState={{ selected: selected === day.key }}
          className={`min-h-12 min-w-0 flex-1 items-center justify-center rounded-xl border-2 py-3 ${available ? 'bg-mint' : 'bg-ink-2'}`}
          style={{ borderColor: selected === day.key ? '#FF5A1F' : 'transparent' }}>
          <Text maxFontSizeMultiplier={1.3} className={`font-sans text-xs font-semibold ${available ? 'text-ink' : 'text-paper'}`}>{day.short}</Text>
        </Pressable>;
      })}
    </View>
    <View className="mt-4 gap-1">
      <Text className="font-sans text-sm text-paper">{WEEK_DAYS.find(day => day.key === selected)?.label}</Text>
      <Text className="font-sans text-base text-mint">{windows.length ? windows.map(entry => `${formatTime(entry.start_time)} – ${formatTime(entry.end_time)}`).join('\n') : 'Not available'}</Text>
    </View>
    <View className="mt-5 flex-row flex-wrap items-center justify-between gap-2 border-t border-white/20 pt-3">
      <Text className="font-sans text-xs text-paper">{cap === null ? 'Weekly limit not set by agency' : `Agency limit · ${cap} hours per week`}</Text>
      <Pressable onPress={onEdit} accessibilityRole="button" className="min-h-11 flex-row items-center self-start gap-2">
        <Text className="font-sans text-sm font-semibold text-mint">Edit availability</Text><Ionicons name="arrow-forward" size={17} color="#9DE8DC" />
      </Pressable>
    </View>
  </View>;
}

export function ProfileRow({ title, detail, icon, onPress, last = false }: {
  title: string; detail: string; icon: ComponentProps<typeof Ionicons>['name']; onPress: () => void; last?: boolean;
}) {
  return <Pressable onPress={onPress} accessibilityRole="button" className={`min-h-20 flex-row items-center gap-3 py-4 ${last ? '' : 'border-b border-cream-2'}`}>
    <View className="h-10 w-10 items-center justify-center rounded-full bg-cream-2"><Ionicons name={icon} size={20} color="#4A453E" /></View>
    <View className="flex-1 gap-1"><Text className="font-sans text-base font-semibold text-ink">{title}</Text><Text className="font-sans text-xs leading-5 text-ink-soft">{detail}</Text></View>
    <Ionicons name="chevron-forward" size={18} color="#4A453E" />
  </Pressable>;
}

export function ReadOnlyDetail({ label, value }: { label: string; value: string | null | undefined }) {
  return <View className="mb-4 gap-1"><Text className="font-sans text-xs text-ink-soft">{label}</Text><Text selectable className="font-sans text-base text-ink">{value || 'Not provided'}</Text></View>;
}
