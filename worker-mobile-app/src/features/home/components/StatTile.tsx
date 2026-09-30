import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface StatTileProps {
  label: string;
  value: string | number | null;
  unit?: string;
  detail: string;
  highlight?: boolean;
  onPress: () => void;
}

export function StatTile({ label, value, unit, detail, highlight, onPress }: StatTileProps) {
  return <Pressable accessibilityRole="button" onPress={onPress} className="flex-1 rounded-2xl border border-cream-2 bg-paper p-3.5">
    <Text className="font-mono text-[10px] uppercase tracking-wider text-ink-soft">{label}</Text>
    <View className="my-2 flex-row flex-wrap items-baseline gap-1">
      <Text className={`font-serif text-4xl ${highlight ? 'text-orange' : 'text-ink'}`}>{value ?? '—'}</Text>
      {unit && value != null ? <Text className="text-sm text-ink-soft">{unit}</Text> : null}
    </View>
    <View className="flex-row items-center gap-1">
      <Text className="flex-1 text-xs leading-4 text-ink-soft">{detail}</Text>
      <Ionicons name="arrow-up-outline" size={13} color="#8A8378" style={{ transform: [{ rotate: '45deg' }] }} />
    </View>
  </Pressable>;
}
