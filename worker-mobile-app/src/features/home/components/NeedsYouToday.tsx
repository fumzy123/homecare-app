import { View, Text, Pressable } from 'react-native';
import { ActionCardStack } from './ActionCardStack';
import { UrgentActionCard, type UrgentAction } from './UrgentActionCard';
export type { UrgentAction } from './UrgentActionCard';

interface NeedsYouTodayProps {
  actions: UrgentAction[];
  onViewAll?: () => void;
  showHeading?: boolean;
  stacked?: boolean;
  onInteractionChange?: (active: boolean) => void;
}

/** Layer 2: presents action items supplied by the home orchestrator. */
export function NeedsYouToday({ actions, onViewAll, showHeading = true, stacked = false, onInteractionChange }: NeedsYouTodayProps) {
  if (actions.length === 0) return null;

  return (
    <View>
      {showHeading ? <View className="mb-3 flex-row flex-wrap items-center justify-between gap-2">
        <Text accessibilityRole="header" className="font-serif text-xl text-ink">Needs your attention</Text>
        <Pressable onPress={onViewAll} disabled={!onViewAll}
          accessibilityRole={onViewAll ? 'button' : undefined}
          accessibilityLabel={`View ${actions.length} action ${actions.length === 1 ? 'item' : 'items'}`}
          accessibilityHint={onViewAll ? 'Opens the full action items list' : undefined}
          className="min-h-11 min-w-11 items-center justify-center">
          <View className="rounded-full bg-orange px-2 py-0.5">
            <Text className="font-mono text-xs font-bold text-white">{actions.length} ITEM{actions.length > 1 ? 'S' : ''}</Text>
          </View>
        </Pressable>
      </View> : null}

      {stacked ? <ActionCardStack actions={actions} onInteractionChange={onInteractionChange} />
        : actions.map(action => <View key={action.id} className="mb-2"><UrgentActionCard action={action} /></View>)}
    </View>
  );
}
