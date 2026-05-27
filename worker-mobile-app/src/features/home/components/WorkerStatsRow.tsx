import { View } from 'react-native';
import { StatTile } from './StatTile';
import type { WorkerStats } from '@/features/profile/types';

interface WorkerStatsRowProps {
  stats: WorkerStats | undefined;
}

export function WorkerStatsRow({ stats }: WorkerStatsRowProps) {
  const cap = stats?.weekly_hour_cap ? `${stats.weekly_hour_cap}h` : undefined;

  return (
    <View className="mb-6 flex-row gap-2">
      <StatTile
        label="This Wk"
        value={stats ? stats.hours_this_week : null}
        cap={cap}
      />
      <StatTile
        label="Punctuality Streak"
        value={stats?.punctuality_streak ?? null}
        unit={stats?.punctuality_streak != null ? 'days' : undefined}
        highlight
      />
      <StatTile
        label="Care Log Streak"
        value={stats?.care_log_streak ?? null}
        unit={stats?.care_log_streak != null ? 'days' : undefined}
      />
    </View>
  );
}
