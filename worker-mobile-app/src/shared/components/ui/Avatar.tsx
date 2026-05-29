import { View, Text } from 'react-native';

type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

const containerSizes: Record<AvatarSize, string> = {
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-14 w-14',
  xl: 'h-24 w-24',
};

const textSizes: Record<AvatarSize, string> = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
  xl: 'text-2xl',
};

type AvatarProps = { initials: string; size?: AvatarSize; className?: string };

export function Avatar({ initials, size = 'md', className }: AvatarProps) {
  return (
    <View
      className={`items-center justify-center rounded-full bg-cream-2 ${containerSizes[size]} ${className ?? ''}`}
    >
      <Text className={`font-mono font-bold text-ink ${textSizes[size]}`}>
        {initials}
      </Text>
    </View>
  );
}
