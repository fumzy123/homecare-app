import { View, Text, type ViewProps } from 'react-native';

type TagProps = ViewProps & { children: React.ReactNode; className?: string };

export function Tag({ children, className, ...props }: TagProps) {
  return (
    <View
      className={`flex-row items-center rounded-full border border-cream-2 bg-paper px-3 py-1 ${className ?? ''}`}
      {...props}
    >
      <Text className="font-mono text-xs text-ink-soft">{children}</Text>
    </View>
  );
}
