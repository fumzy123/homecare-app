import { View, Text } from 'react-native';
import { StatTile } from './StatTile';

interface Props {
  completedHours: number | null;
  scheduledHours: number | null;
  onHoursPress: () => void;
}

export function WorkerStatsRow({ completedHours, scheduledHours, onHoursPress }: Props) {
  return <View>
    <Text accessibilityRole="header" className="mb-3 font-serif text-xl text-ink">This week</Text>
    <View className="flex-row gap-2.5">
      <StatTile label="Hours completed this week" value={completedHours == null ? null : Number(completedHours.toFixed(1))} unit="hrs"
        detail={scheduledHours == null ? 'Hours unavailable' : `${Number(scheduledHours.toFixed(1))} hrs scheduled · Est.`} onPress={onHoursPress} />
    </View>
  </View>;
}
