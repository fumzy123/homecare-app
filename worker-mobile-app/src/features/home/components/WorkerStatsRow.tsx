import { View } from 'react-native';
import { StatTile } from './StatTile';

interface Props {
  completedHours: number | null;
  scheduledHours: number | null;
  streak: number | null;
  onHoursPress: () => void;
  onStreakPress: () => void;
}

export function WorkerStatsRow({ completedHours, scheduledHours, streak, onHoursPress, onStreakPress }: Props) {
  return <View className="mb-5 flex-row gap-2.5">
    <StatTile label="Completed this week" value={completedHours == null ? null : Number(completedHours.toFixed(1))} unit="hrs"
      detail={scheduledHours == null ? 'Hours unavailable' : `${Number(scheduledHours.toFixed(1))} hrs scheduled · Est.`} onPress={onHoursPress} />
    <StatTile label="On-time streak" value={streak} unit="days" highlight
      detail={streak == null ? 'Not available yet' : 'Showing up with care'} onPress={onStreakPress} />
  </View>;
}
