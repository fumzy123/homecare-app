import { View, Text } from 'react-native';

export function SectionDivider({ label }: { label: string }) {
  return (
    <View className="mx-5 my-1.5 flex-row items-center gap-2.5">
      <View className="h-px flex-1 bg-ink" />
      <Text className="font-mono text-[8.5px] uppercase tracking-[0.15em] text-ink-soft">
        {label}
      </Text>
      <View className="h-px flex-1 bg-ink" />
    </View>
  );
}
