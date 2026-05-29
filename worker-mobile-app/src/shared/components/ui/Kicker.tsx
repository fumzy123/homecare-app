import { Text, type TextProps } from 'react-native';

type KickerProps = TextProps & { children: React.ReactNode };

export function Kicker({ children, className, ...props }: KickerProps) {
  return (
    <Text
      className={`font-mono text-xs tracking-widest text-muted uppercase ${className ?? ''}`}
      {...props}
    >
      {children}
    </Text>
  );
}
