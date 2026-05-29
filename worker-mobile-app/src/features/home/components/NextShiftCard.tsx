import { View, Text, Pressable, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar, StatusDot } from '@/shared/components/ui';
import { useCountdown } from '@/shared/hooks/useCountdown';
import { getInitials } from '@/shared/utils/getInitials';
import { formatDuration } from '@/shared/utils/formatDuration';
import { formatTime } from '@/shared/utils/formatTime';
import type { ShiftOccurrence } from '@/features/shifts/types';

function getClientAge(dateOfBirth: string): number {
  const today = new Date();
  const dob = new Date(dateOfBirth);
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}

function formatFocus(serviceType: string, medicalConditions: string | null): string | null {
  const service = serviceType
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
  if (!medicalConditions) return service;
  return `${service} · ${medicalConditions}`;
}

function getDirectionsUrl(street: string, city: string): string {
  const query = encodeURIComponent(`${street}, ${city}`);
  return `https://maps.google.com/?q=${query}`;
}

interface NextShiftCardProps {
  shift: ShiftOccurrence;
  shiftIndex: number;
  totalToday: number;
  onDetailsPress?: () => void;
}

export function NextShiftCard({ shift, shiftIndex, totalToday, onDetailsPress }: NextShiftCardProps) {
  const { client, start_time, end_time } = shift;
  const countdown = useCountdown(start_time);
  const initials = getInitials(client.first_name, client.last_name);
  const age = getClientAge(client.date_of_birth);
  const duration = formatDuration(start_time, end_time, 'long');
  const focus = formatFocus(client.service_type, client.medical_conditions);
  const address = `${client.street}, ${client.city}`;

  const now = new Date();
  const start = new Date(start_time);
  const isLate = now > start;

  const handleDirections = () => {
    Linking.openURL(getDirectionsUrl(client.street, client.city));
  };

  return (
    <View className="mb-2">
      <View className="mb-2 flex-row items-center justify-between">
        <Text className="font-mono text-xs uppercase tracking-widest text-muted">Next Shift</Text>
        <Text className="font-mono text-xs text-muted">
          Shift {shiftIndex} of {totalToday} · Today
        </Text>
      </View>

      <View className="rounded-2xl bg-ink p-5">
        {/* Client info */}
        <View className="mb-4 flex-row items-center gap-4">
          <Avatar initials={initials} size="lg" className="bg-orange" />
          <View className="flex-1">
            <Text className="font-serif text-xl text-cream">
              {client.first_name} <Text className="italic">{client.last_name}</Text>
            </Text>
            <Text className="mt-0.5 font-sans text-xs text-cream opacity-60" numberOfLines={1}>
              {age} years · {address}
            </Text>
          </View>
        </View>

        {/* Countdown + Status */}
        {countdown && (
          <>
            <View className="mb-4 border-b border-cream opacity-10" />
            <View className="mb-4 flex-row items-end justify-between">
              <View>
                <Text className="mb-1 font-mono text-xs uppercase tracking-widest text-cream opacity-40">Starting in</Text>
                <Text className="font-mono text-4xl text-orange">{countdown}</Text>
              </View>
              <View>
                <Text className="mb-1 font-mono text-xs uppercase tracking-widest text-cream opacity-40">Status</Text>
                <View className="flex-row items-center gap-1.5">
                  <StatusDot color={isLate ? 'red' : 'green'} />
                  <Text className="font-mono text-xs text-cream opacity-80">
                    {isLate ? 'LATE' : 'ON TIME'}
                  </Text>
                </View>
              </View>
            </View>
          </>
        )}

        <View className="mb-4 border-b border-cream opacity-10" />

        {/* Times */}
        <View className="mb-4 flex-row items-start">
          {/* Stacked start / end */}
          <View className="flex-1">
            <Text className="font-mono text-xs uppercase tracking-widest text-cream opacity-40">Start</Text>
            <Text className="mb-3 font-mono text-2xl text-cream">{formatTime(start_time)}</Text>
            <Text className="font-mono text-xs uppercase tracking-widest text-cream opacity-40">End</Text>
            <Text className="font-mono text-2xl text-cream">{formatTime(end_time)}</Text>
          </View>

          <View className="mx-4 w-px self-stretch bg-cream opacity-10" />

          {/* Duration */}
          <View>
            <Text className="mb-1 font-mono text-xs uppercase tracking-widest text-cream opacity-40">Duration</Text>
            <Text className="font-mono text-xl text-cream">{duration}</Text>
          </View>
        </View>

        <View className="mb-4 border-b border-cream opacity-10" />

        {/* Focus */}
        {focus && (
          <View className="mb-5">
            <Text className="mb-1 font-mono text-xs uppercase tracking-widest text-cream opacity-40">Focus</Text>
            <Text className="font-sans text-sm text-cream opacity-80">{focus}</Text>
          </View>
        )}

        {/* Buttons */}
        <View className="flex-row gap-3">
          <Pressable
            onPress={handleDirections}
            className="flex-1 flex-row items-center justify-center gap-2 rounded-full bg-orange py-3"
          >
            <Ionicons name="location-outline" size={16} color="white" />
            <Text className="font-sans text-sm font-semibold text-white">Get directions</Text>
          </Pressable>
          <Pressable
            onPress={onDetailsPress}
            className="flex-1 items-center justify-center rounded-full border border-cream py-3"
          >
            <Text className="font-sans text-sm font-semibold text-cream">Shift details</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
