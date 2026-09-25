import { Linking, Pressable, Text, View } from 'react-native';
import type { ReactNode } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { formatDuration } from '@/shared/utils/formatDuration';
import { formatTime } from '@/shared/utils/formatTime';
import { serviceTypeLabel } from '../lib/schedule';
import type { WorkerShiftDetail } from '../types';

export function ShiftTimeCard({ shift }: { shift: WorkerShiftDetail }) {
  return (
    <View className="mt-5 rounded-2xl bg-ink p-5">
      <Text className="font-mono text-[10px] uppercase tracking-widest text-cream opacity-50">Scheduled time</Text>
      <Text className="mt-2 font-mono text-2xl text-cream">
        {formatTime(shift.start_time)} — {formatTime(shift.end_time)}
      </Text>
      <View className="my-4 h-px bg-cream opacity-10" />
      <View className="flex-row items-end justify-between">
        <View>
          <Text className="font-mono text-[10px] uppercase tracking-widest text-cream opacity-50">Service</Text>
          <Text className="mt-1 font-serif text-xl text-cream">{serviceTypeLabel(shift.service_type)}</Text>
        </View>
        <View className="items-end">
          <Text className="font-mono text-[10px] uppercase tracking-widest text-cream opacity-50">Duration</Text>
          <Text className="mt-1 font-mono text-base text-orange">
            {formatDuration(shift.start_time, shift.end_time, 'long')}
          </Text>
        </View>
      </View>
    </View>
  );
}

function DetailCard({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View className="mt-3 rounded-2xl border border-cream-2 bg-paper p-4">
      <Text className="font-mono text-[10px] uppercase tracking-widest text-muted">{label}</Text>
      <View className="mt-2">{children}</View>
    </View>
  );
}

export function ShiftLocationCard({ location }: { location: string }) {
  const openDirections = () => Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(location)}`);
  return (
    <DetailCard label="Location">
      <View className="flex-row items-center justify-between gap-3">
        <View className="flex-1 flex-row items-start gap-2">
          <Ionicons name="location-outline" size={17} color="#8A8378" />
          <Text className="flex-1 font-sans text-sm leading-5 text-ink">{location}</Text>
        </View>
        <Pressable
          onPress={openDirections}
          className="rounded-full border border-orange px-3 py-2"
          accessibilityLabel={`Get directions to ${location}`}
        >
          <Text className="font-sans text-xs font-semibold text-orange">Directions</Text>
        </Pressable>
      </View>
    </DetailCard>
  );
}

export function ShiftCareCard({ careFocus }: { careFocus: string }) {
  return (
    <DetailCard label="Care focus">
      <Text className="font-sans text-sm leading-5 text-ink">{careFocus}</Text>
    </DetailCard>
  );
}

export function ShiftInstructionsCard({ instructions }: { instructions: string }) {
  return (
    <DetailCard label="Shift instructions">
      <Text className="font-sans text-sm leading-5 text-ink">{instructions}</Text>
    </DetailCard>
  );
}
