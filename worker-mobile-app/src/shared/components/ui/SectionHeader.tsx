import { View, Text } from 'react-native';

type SectionHeaderProps = { title: string; subtitle?: string; className?: string };

export function SectionHeader({ title, subtitle, className }: SectionHeaderProps) {
  return (
    <View className={`mb-4 ${className ?? ''}`}>
      <Text className="font-serif text-2xl text-ink">{title}</Text>
      {subtitle ? <Text className="mt-1 font-sans text-sm text-muted">{subtitle}</Text> : null}
    </View>
  );
}
