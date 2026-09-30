import { View, Text, Pressable } from 'react-native';
import { Kicker } from '@/shared/components/ui';

export interface UrgentAction {
  id: string;
  label: string;
  description: string;
  status: string;
  onPress: () => void;
}

interface NeedsYouTodayProps {
  actions: UrgentAction[];
  onViewAll?: () => void;
  showHeading?: boolean;
}

/** Layer 2: presents action items supplied by the home orchestrator. */
export function NeedsYouToday({ actions, onViewAll, showHeading = true }: NeedsYouTodayProps) {
  if (actions.length === 0) return null;

  return (
    <View className="mb-4">
      {showHeading ? <View className="mb-3 flex-row flex-wrap items-center justify-between gap-2">
        <Kicker>Needs your attention</Kicker>
        <View className="rounded-full bg-orange px-2 py-0.5">
          <Text className="font-mono text-xs font-bold text-white">{actions.length} ITEM{actions.length > 1 ? 'S' : ''}</Text>
        </View>
      </View> : null}

      {(onViewAll ? actions.slice(0, 3) : actions).map((action) => (
        <Pressable
          key={action.id}
          onPress={action.onPress}
          accessibilityRole="button"
          className="mb-2 min-h-14 flex-row items-center justify-between rounded-xl border border-orange-soft bg-orange-soft px-4 py-3"
        >
          <View className="flex-1 pr-3">
            <Text className="mb-1 font-mono text-[10px] uppercase tracking-wider text-orange">{action.status}</Text>
            <Text className="font-sans text-sm font-semibold text-ink">{action.label}</Text>
            <Text className="mt-0.5 font-sans text-xs text-ink-soft">{action.description}</Text>
          </View>
          <Text className="font-mono text-xs text-orange">→</Text>
        </Pressable>
      ))}
      {onViewAll && actions.length > 3 ? <Pressable accessibilityRole="button" onPress={onViewAll} className="min-h-11 justify-center py-2">
        <Text className="text-sm font-semibold text-orange">View all {actions.length} action items →</Text>
      </Pressable> : null}
    </View>
  );
}
