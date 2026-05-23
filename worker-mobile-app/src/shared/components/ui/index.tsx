import React from 'react';
import {
  Pressable,
  Text,
  View,
  type PressableProps,
  type ViewProps,
  type TextProps,
} from 'react-native';

// ─── Kicker ──────────────────────────────────────────────────────────────────
// Small mono uppercase label — mirrors the web Kicker component.

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

// ─── Btn ─────────────────────────────────────────────────────────────────────
// Primary / ghost / danger variants. Min 44pt touch target per Apple HIG.

type BtnVariant = 'primary' | 'ghost' | 'danger';

type BtnProps = PressableProps & {
  children: React.ReactNode;
  variant?: BtnVariant;
  className?: string;
};

const BtnStyles: Record<BtnVariant, string> = {
  primary: 'bg-orange',
  ghost: 'bg-transparent border border-ink',
  danger: 'bg-rose',
};

const BtnTextStyles: Record<BtnVariant, string> = {
  primary: 'text-white',
  ghost: 'text-ink',
  danger: 'text-ink',
};

export function Btn({ children, variant = 'primary', className, disabled, ...props }: BtnProps) {
  return (
    <Pressable
      className={`min-h-11 flex-row items-center justify-center rounded-full px-6 ${BtnStyles[variant]} ${disabled ? 'opacity-50' : ''} ${className ?? ''}`}
      disabled={disabled}
      {...props}
    >
      <Text className={`font-sans text-sm font-semibold ${BtnTextStyles[variant]}`}>
        {children}
      </Text>
    </Pressable>
  );
}

// ─── Tag ─────────────────────────────────────────────────────────────────────

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

// ─── Card ─────────────────────────────────────────────────────────────────────

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

// ─── StatusDot ───────────────────────────────────────────────────────────────

type StatusDotColor = 'green' | 'orange' | 'red' | 'muted';

const DotColors: Record<StatusDotColor, string> = {
  green: 'bg-mint-dark',
  orange: 'bg-orange',
  red: 'bg-rose',
  muted: 'bg-muted',
};

type StatusDotProps = { color: StatusDotColor; className?: string };

export function StatusDot({ color, className }: StatusDotProps) {
  return (
    <View className={`h-2 w-2 rounded-full ${DotColors[color]} ${className ?? ''}`} />
  );
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

type AvatarProps = { initials: string; size?: 'sm' | 'md' | 'lg'; className?: string };

const AvatarSizes = { sm: 'h-8 w-8', md: 'h-10 w-10', lg: 'h-14 w-14' };
const AvatarTextSizes = { sm: 'text-xs', md: 'text-sm', lg: 'text-base' };

export function Avatar({ initials, size = 'md', className }: AvatarProps) {
  return (
    <View
      className={`items-center justify-center rounded-full bg-cream-2 ${AvatarSizes[size]} ${className ?? ''}`}
    >
      <Text className={`font-mono font-bold text-ink ${AvatarTextSizes[size]}`}>
        {initials}
      </Text>
    </View>
  );
}

// ─── SectionHeader ───────────────────────────────────────────────────────────

type SectionHeaderProps = { title: string; subtitle?: string; className?: string };

export function SectionHeader({ title, subtitle, className }: SectionHeaderProps) {
  return (
    <View className={`mb-4 ${className ?? ''}`}>
      <Text className="font-serif text-2xl text-ink">{title}</Text>
      {subtitle ? <Text className="mt-1 font-sans text-sm text-muted">{subtitle}</Text> : null}
    </View>
  );
}

// ─── Divider ─────────────────────────────────────────────────────────────────

export function Divider({ className }: { className?: string }) {
  return <View className={`h-px bg-cream-2 ${className ?? ''}`} />;
}
