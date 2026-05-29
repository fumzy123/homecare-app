import { View, Text } from 'react-native';

interface ProfileFieldProps {
  label: string;
  value?: string | null;
  mono?: boolean;
  children?: React.ReactNode;
}

export function ProfileField({ label, value, mono, children }: ProfileFieldProps) {
  return (
    <View
      className="flex-row items-baseline justify-between gap-4 border-b border-ink/[0.08] py-2.5"
    >
      <Text className="shrink-0 pt-px font-mono text-[9px] uppercase tracking-widest text-ink-soft">
        {label}
      </Text>
      {children ?? (
        <Text
          className={`text-right font-medium leading-snug ${mono ? 'font-mono text-[11.5px]' : 'text-[12.5px]'} text-ink`}
          numberOfLines={2}
        >
          {value ?? '—'}
        </Text>
      )}
    </View>
  );
}
