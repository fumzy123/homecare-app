import { View, type ViewProps } from 'react-native';

type CardProps = ViewProps & { children: React.ReactNode; className?: string };

export function Card({ children, className, ...props }: CardProps) {
  return (
    <View
      className={`rounded-2xl border border-cream-2 bg-paper p-4 ${className ?? ''}`}
      {...props}
    >
      {children}
    </View>
  );
}
