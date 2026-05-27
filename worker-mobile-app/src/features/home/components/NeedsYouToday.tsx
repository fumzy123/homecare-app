import { View, Text, Pressable } from 'react-native';
import { Kicker } from '@/shared/components/ui';

export interface UrgentAction {
  id: string;
  label: string;
  description: string;
  onPress: () => void;
}

interface NeedsYouTodayProps {
  actions: UrgentAction[];
}

export function NeedsYouToday({ actions }: NeedsYouTodayProps) {
  if (actions.length === 0) return null;

  return (
    <View className="mt-6">
      <View className="mb-3 flex-row items-center justify-between">
        <Kicker>Needs You Today</Kicker>
        <View className="rounded-full bg-orange px-2 py-0.5">
          <Text className="font-mono text-xs font-bold text-white">{actions.length} ITEM{actions.length > 1 ? 'S' : ''}</Text>
        </View>
      </View>

      {actions.map((action) => (
        <Pressable
          key={action.id}
          onPress={action.onPress}
          className="mb-2 flex-row items-center justify-between rounded-xl border border-orange-soft bg-orange-soft px-4 py-3"
        >
          <View className="flex-1 pr-3">
            <Text className="font-sans text-sm font-semibold text-ink">{action.label}</Text>
            <Text className="mt-0.5 font-sans text-xs text-ink-soft">{action.description}</Text>
          </View>
          <Text className="font-mono text-xs text-orange">→</Text>
        </Pressable>
      ))}
    </View>
  );
}
