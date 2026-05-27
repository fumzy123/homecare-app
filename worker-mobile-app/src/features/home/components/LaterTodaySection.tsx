import { View } from 'react-native';
import { Kicker } from '@/shared/components/ui';
import { CompactShiftRow } from './CompactShiftRow';
import type { ShiftOccurrence } from '@/features/shifts/types';

interface LaterTodaySectionProps {
  shifts: ShiftOccurrence[];
  onShiftPress?: (shift: ShiftOccurrence) => void;
}

export function LaterTodaySection({ shifts, onShiftPress }: LaterTodaySectionProps) {
  if (shifts.length === 0) return null;

  return (
    <View className="mt-6">
      <Kicker className="mb-3">Later Today</Kicker>
      {shifts.map((shift) => (
        <CompactShiftRow
          key={shift.shift_id}
          shift={shift}
          onPress={() => onShiftPress?.(shift)}
          className="mb-2"
        />
      ))}
    </View>
  );
}
