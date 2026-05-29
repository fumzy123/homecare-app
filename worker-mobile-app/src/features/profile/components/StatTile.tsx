import { View, Text } from 'react-native';

interface StatTileProps {
  kicker: string;
  value: string;
  unit?: string;
  accent?: boolean;
}

export function StatTile({ kicker, value, unit, accent }: StatTileProps) {
  return (
    <View className="h-[101px] flex-1 justify-between border border-ink bg-paper p-3">
      <Text className="font-mono text-[8.5px] uppercase leading-tight tracking-widest text-ink-soft">
        {kicker}
      </Text>
      <Text className={`font-serif text-[26px] leading-none ${accent ? 'text-orange' : 'text-ink'}`}>
        {value}
        {unit && (
          <Text className="font-mono text-[11px] text-ink-soft"> {unit}</Text>
        )}
      </Text>
    </View>
  );
}
