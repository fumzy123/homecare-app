import { View, Text } from 'react-native';
import type { ShiftCompletionStatus } from '../types';

const CONFIG: Record<ShiftCompletionStatus, { bg: string; text: string; label: string }> = {
  scheduled:   { bg: 'bg-cream-2',    text: 'text-ink-soft', label: 'Scheduled'   },
  in_progress: { bg: 'bg-orange-soft', text: 'text-orange',   label: 'In Progress' },
  completed:   { bg: 'bg-mint',        text: 'text-mint-dark', label: 'Completed'   },
  cancelled:   { bg: 'bg-cream-2',    text: 'text-muted',    label: 'Cancelled'   },
};

export function ShiftStatusBadge({ status }: { status: ShiftCompletionStatus }) {
  const { bg, text, label } = CONFIG[status];
  return (
    <View className={`self-start rounded-full px-3 py-1 ${bg}`}>
      <Text className={`font-mono text-xs ${text}`}>{label}</Text>
    </View>
  );
}
