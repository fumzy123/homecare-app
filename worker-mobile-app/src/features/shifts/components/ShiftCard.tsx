import { View, Text } from 'react-native';
import { ShiftStatusBadge } from './ShiftStatusBadge';
import { formatTimeRange } from '@/shared/utils/formatTime';
import type { ShiftOccurrence } from '../types';

type ShiftCardVariant = 'default' | 'featured';

interface ShiftCardProps {
  shift: ShiftOccurrence;
  variant?: ShiftCardVariant;
  className?: string;
}

export function ShiftCard({ shift, variant = 'default', className = '' }: ShiftCardProps) {
  const isFeatured = variant === 'featured';
  const { client, start_time, end_time, location, completion_status } = shift;
  const clientName = `${client.first_name} ${client.last_name}`;

  return (
    <View className={`rounded-2xl border border-cream-2 bg-paper p-4 ${className}`}>
      <ShiftStatusBadge status={completion_status} />

      <Text
        className={`mt-3 font-serif text-ink ${isFeatured ? 'text-2xl' : 'text-lg'}`}
        numberOfLines={1}
      >
        {clientName}
      </Text>

      <Text className="mt-1 font-mono text-sm text-ink-soft">
        {formatTimeRange(start_time, end_time)}
      </Text>

      {location ? (
        <Text className="mt-1 font-sans text-xs text-muted" numberOfLines={1}>
          {location}
        </Text>
      ) : null}
    </View>
  );
}
