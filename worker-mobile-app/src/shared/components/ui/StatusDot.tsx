import { View } from 'react-native';

type StatusDotColor = 'green' | 'orange' | 'red' | 'muted';

const dotColors: Record<StatusDotColor, string> = {
  green: 'bg-mint-dark',
  orange: 'bg-orange',
  red: 'bg-rose',
  muted: 'bg-muted',
};

type StatusDotProps = { color: StatusDotColor; className?: string };

export function StatusDot({ color, className }: StatusDotProps) {
  return (
    <View className={`h-2 w-2 rounded-full ${dotColors[color]} ${className ?? ''}`} />
  );
}
