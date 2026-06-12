import { View, Text, type ViewProps } from 'react-native';

type TagVariant = 'default' | 'orange' | 'mint';

type TagProps = ViewProps & {
  children: React.ReactNode;
  className?: string;
  variant?: TagVariant;
};

const VARIANTS: Record<TagVariant, { container: string; text: string }> = {
  default: { container: 'border-cream-2 bg-paper',   text: 'text-ink-soft' },
  orange:  { container: 'border-orange bg-orange-soft', text: 'text-ink' },
  mint:    { container: 'border-mint bg-mint/20',     text: 'text-ink' },
};

export function Tag({ children, className, variant = 'default', ...props }: TagProps) {
  const v = VARIANTS[variant];
  return (
    <View
      className={`flex-row items-center rounded-full border px-3 py-1 ${v.container} ${className ?? ''}`}
      {...props}
    >
      <Text className={`font-mono text-xs ${v.text}`}>{children}</Text>
    </View>
  );
}
