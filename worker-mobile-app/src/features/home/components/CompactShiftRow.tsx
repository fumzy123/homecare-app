import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '@/shared/components/ui';
import { getInitials } from '@/shared/utils/getInitials';
import { formatDuration } from '@/shared/utils/formatDuration';
import type { ShiftOccurrence } from '@/features/shifts/types';

function formatHour(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatServiceType(raw: string): string {
  return raw
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

interface CompactShiftRowProps {
  shift: ShiftOccurrence;
  onPress?: () => void;
  className?: string;
}

export function CompactShiftRow({ shift, onPress, className = '' }: CompactShiftRowProps) {
  const { client, start_time, end_time } = shift;
  const initials = getInitials(client.first_name, client.last_name);
  const duration = formatDuration(start_time, end_time, 'short');
  const serviceLabel = formatServiceType(client.service_type);
  const address = client.city ? `${client.street} · ${client.city}` : client.street;

  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center rounded-xl border border-cream-2 bg-paper px-4 py-3 ${className}`}
    >
      <View className="mr-4 items-center" style={{ width: 64 }}>
        <Text className="font-mono text-sm font-bold text-ink">{formatHour(start_time)}</Text>
        <Text className="font-mono text-xs text-muted">{duration}</Text>
      </View>

      <Avatar initials={initials} size="sm" className="mr-3 bg-lavender" />

      <View className="flex-1">
        <Text className="font-sans text-sm font-semibold text-ink" numberOfLines={1}>
          {client.first_name} {client.last_name}
        </Text>
        <Text className="font-sans text-xs text-muted" numberOfLines={1}>
          {serviceLabel} · {address}
        </Text>
      </View>

      <Ionicons name="chevron-forward" size={16} color="#8A8378" />
    </Pressable>
  );
}
