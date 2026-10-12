import { View, Text, Pressable } from 'react-native';

export interface UrgentAction {
  id: string;
  label: string;
  description: string;
  status: string;
  onPress: () => void;
}

/** Layer 2: same action card in the Home deck and full attention list. */
export function UrgentActionCard({ action, minHeight = 56, disabled = false, onPress = action.onPress }: {
  action: UrgentAction;
  minHeight?: number;
  disabled?: boolean;
  onPress?: () => void;
}) {
  return <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button"
    style={{ minHeight }}
    className="min-h-14 flex-row items-center justify-between rounded-xl border border-ink bg-orange-soft px-4 py-3">
    <View className="flex-1 pr-3">
      <Text className="mb-1 font-mono text-[10px] uppercase tracking-wider text-orange">{action.status}</Text>
      <Text className="font-sans text-sm font-semibold text-ink">{action.label}</Text>
      <Text className="mt-0.5 font-sans text-xs text-ink-soft">{action.description}</Text>
    </View>
    <Text className="font-mono text-xs text-orange">→</Text>
  </Pressable>;
}
