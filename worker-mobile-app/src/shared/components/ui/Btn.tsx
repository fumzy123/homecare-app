import { Pressable, Text, type PressableProps } from 'react-native';

type BtnVariant = 'primary' | 'ghost' | 'danger';

type BtnProps = PressableProps & {
  children: React.ReactNode;
  variant?: BtnVariant;
  className?: string;
};

const containerStyles: Record<BtnVariant, string> = {
  primary: 'bg-orange',
  ghost: 'bg-transparent border border-ink',
  danger: 'bg-rose',
};

const textStyles: Record<BtnVariant, string> = {
  primary: 'text-white',
  ghost: 'text-ink',
  danger: 'text-ink',
};

export function Btn({ children, variant = 'primary', className, disabled, ...props }: BtnProps) {
  return (
    <Pressable
      className={`min-h-11 flex-row items-center justify-center rounded-full px-6 ${containerStyles[variant]} ${disabled ? 'opacity-50' : ''} ${className ?? ''}`}
      disabled={disabled}
      {...props}
    >
      <Text className={`font-sans text-sm font-semibold ${textStyles[variant]}`}>
        {children}
      </Text>
    </Pressable>
  );
}
