import { View, Text } from 'react-native';

interface StatTileProps {
  label: string;
  value: string | number | null;
  unit?: string;
  cap?: string;
  highlight?: boolean;
}

export function StatTile({ label, value, unit, cap, highlight = false }: StatTileProps) {
  const displayValue = value ?? '—';

  return (
    <View className="flex-1 rounded-xl border border-cream-2 bg-paper px-3 py-3">
      <Text className="mb-2 font-mono text-xs uppercase tracking-widest text-muted" numberOfLines={2}>
        {label}
      </Text>
      <View className="flex-row items-baseline gap-1">
        <Text className={`font-serif text-2xl ${highlight ? 'text-orange' : 'text-ink'}`}>
          {displayValue}
        </Text>
        {cap && (
          <Text className="font-mono text-xs text-muted">/{cap}</Text>
        )}
        {unit && (
          <Text className="font-sans text-sm text-muted">{unit}</Text>
        )}
      </View>
    </View>
  );
}
