import { type ReactNode, type ButtonHTMLAttributes } from 'react'
import { getStatusToken } from '@/shared/lib/shiftStatus'

// ─── cn utility ──────────────────────────────────────────────────────────────
function cn(...classes: (string | undefined | false | null)[]) {
  return classes.filter(Boolean).join(' ')
}

// ─── Pill ─────────────────────────────────────────────────────────────────────
// Round pills — nav, filters, secondary actions
interface PillProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean
  variant?: 'default' | 'ghost' | 'orange' | 'dark'
  size?: 'sm' | 'md'
  as?: 'button' | 'span'
}

export function Pill({ active, variant = 'default', size = 'md', as: Tag = 'button', className, children, ...props }: PillProps) {
  const base = 'inline-flex items-center gap-1.5 rounded-full border font-mono tracking-wide whitespace-nowrap transition-all duration-150 cursor-pointer select-none'
  const sizes = { sm: 'px-2 py-0.5 text-[10px]', md: 'px-2.5 py-1 text-[11px]' }

  const variants = {
    default: active
      ? 'bg-ink text-cream border-ink'
      : 'bg-transparent text-ink border-ink hover:bg-ink hover:text-cream',
    ghost: active
      ? 'bg-ink text-cream border-ink'
      : 'bg-transparent text-ink-soft border-line-soft hover:text-ink hover:bg-cream-2',
    orange: 'bg-orange text-white border-orange hover:bg-ink hover:border-ink',
    dark: 'bg-ink text-cream border-ink hover:bg-orange hover:border-orange',
  }

  const cls = cn(base, sizes[size], variants[variant], className)

  if (Tag === 'span') {
    return <span className={cls}>{children}</span>
  }
  return <button className={cls} {...props}>{children}</button>
}

// ─── Tag ─────────────────────────────────────────────────────────────────────
// Square corners, mono uppercase — status labels
type TagVariant = 'default' | 'solid' | 'orange' | 'mint' | 'yellow' | 'rose' | 'lavender'

interface TagProps {
  variant?: TagVariant
  children: ReactNode
  className?: string
}

export function Tag({ variant = 'default', children, className }: TagProps) {
  const base = 'inline-flex items-center gap-1.5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.06em] border'
  const variants: Record<TagVariant, string> = {
    default:  'bg-paper text-ink-soft border-line-soft',
    solid:    'bg-ink text-cream border-ink',
    orange:   'bg-orange text-white border-orange',
    mint:     'bg-mint text-ink border-ink',
    yellow:   'bg-yellow text-ink border-yellow',
    rose:     'bg-rose text-ink border-rose',
    lavender: 'bg-lavender text-ink border-lavender',
  }
  return <span className={cn(base, variants[variant], className)}>{children}</span>
}

// ─── Btn ─────────────────────────────────────────────────────────────────────
// Primary actions — black fill, orange CTA, ghost outline
type BtnVariant = 'primary' | 'orange' | 'ghost'

interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant
  size?: 'sm' | 'md'
}

export function Btn({ variant = 'primary', size = 'md', className, children, ...props }: BtnProps) {
  const base = 'inline-flex items-center gap-2 rounded-full border font-mono tracking-wide transition-all duration-150 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed'
  const sizes = { sm: 'px-3 py-1.5 text-[11px]', md: 'px-4 py-2 text-[12px]' }
  const variants: Record<BtnVariant, string> = {
    primary: 'bg-ink text-cream border-ink hover:bg-orange hover:border-orange',
    orange:  'bg-orange text-white border-orange hover:bg-ink hover:border-ink',
    ghost:   'bg-transparent text-ink border-ink hover:bg-ink hover:text-cream',
  }
  return (
    <button className={cn(base, sizes[size], variants[variant], className)} {...props}>
      {children}
    </button>
  )
}

// ─── Card ─────────────────────────────────────────────────────────────────────
// 1px ink border, no radius, no shadow
type CardVariant = 'default' | 'cream' | 'dark' | 'orange' | 'mint'

interface CardProps {
  variant?: CardVariant
  lift?: boolean
  brackets?: boolean
  className?: string
  children: ReactNode
  onClick?: () => void
}

export function Card({ variant = 'default', lift, brackets, className, children, onClick }: CardProps) {
  const base = 'border border-ink relative'
  const variants: Record<CardVariant, string> = {
    default: 'bg-paper',
    cream:   'bg-cream-2',
    dark:    'bg-ink text-cream',
    orange:  'bg-orange text-white border-orange',
    mint:    'bg-mint border-ink',
  }
  return (
    <div
      className={cn(base, variants[variant], lift && 'lift cursor-pointer', onClick && 'cursor-pointer', className)}
      onClick={onClick}
    >
      {brackets && (
        <>
          <span className="bracket-tl" /><span className="bracket-tr" />
          <span className="bracket-bl" /><span className="bracket-br" />
        </>
      )}
      {children}
    </div>
  )
}

// ─── Avatar ──────────────────────────────────────────────────────────────────
// Circle, mono initials, 6 color variants
type AvatarColor = 'default' | 'c1' | 'c2' | 'c3' | 'c4' | 'c5' | 'c6'
type AvatarSize  = 'sm' | 'md' | 'lg' | 'xl'

interface AvatarProps {
  initials: string
  color?: AvatarColor
  size?: AvatarSize
  className?: string
}

export function Avatar({ initials, color = 'default', size = 'md', className }: AvatarProps) {
  const sizes: Record<AvatarSize, string> = {
    sm: 'w-7 h-7 text-[10px]',
    md: 'w-8 h-8 text-[11px]',
    lg: 'w-14 h-14 text-[17px]',
    xl: 'w-20 h-20 text-[24px]',
  }
  const colors: Record<AvatarColor, string> = {
    default: 'bg-ink text-cream border-ink',
    c1:      'bg-orange text-white border-orange',
    c2:      'bg-mint text-ink border-mint',
    c3:      'bg-yellow text-ink border-yellow',
    c4:      'bg-lavender text-ink border-lavender',
    c5:      'bg-rose text-ink border-rose',
    c6:      'bg-cream-2 text-ink border-ink',
  }
  return (
    <div className={cn(
      'rounded-full border flex items-center justify-center font-mono font-semibold shrink-0',
      sizes[size], colors[color], className
    )}>
      {initials.slice(0, 2).toUpperCase()}
    </div>
  )
}

// ─── Kicker ──────────────────────────────────────────────────────────────────
// Mono uppercase section label with dash leader
interface KickerProps {
  children: ReactNode
  className?: string
  leader?: boolean
}

export function Kicker({ children, className, leader = false }: KickerProps) {
  return (
    <div className={cn('font-mono text-[10px] uppercase tracking-[0.15em] text-ink-soft flex items-center gap-3', className)}>
      {leader && <span className="inline-block w-6 h-px bg-ink" />}
      {children}
    </div>
  )
}

// ─── StatusDot ───────────────────────────────────────────────────────────────
// Colored dot + mono caps label
type StatusVariant = 'scheduled' | 'in_progress' | 'completed' | 'no_show' | 'cancelled' | 'dropped' | 'active' | 'inactive' | 'on_hold'

interface StatusDotProps {
  status: StatusVariant | string
  className?: string
}

const STATUS_MAP: Record<string, { dot: string; label: string }> = {
  scheduled:   { dot: 'dot-orange',  label: 'SCHEDULED' },
  in_progress: { dot: 'dot-mint',    label: 'IN PROGRESS' },
  completed:   { dot: 'dot-ink',     label: 'COMPLETED' },
  no_show:     { dot: 'dot-yellow',  label: 'NO SHOW' },
  cancelled:   { dot: 'dot-muted',   label: 'CANCELLED' },
  dropped:     { dot: 'dot-orange',  label: 'DROPPED' },
  active:      { dot: 'dot-mint',    label: 'ACTIVE' },
  inactive:    { dot: 'dot-muted',   label: 'INACTIVE' },
  on_hold:     { dot: 'dot-yellow',  label: 'ON HOLD' },
  discharged:  { dot: 'dot-muted',   label: 'DISCHARGED' },
}

export function StatusDot({ status, className }: StatusDotProps) {
  const m = STATUS_MAP[status] ?? { dot: 'dot-muted', label: status.toUpperCase().replace(/_/g, ' ') }
  return (
    <span className={cn('inline-flex items-center gap-1.5 font-mono text-[10px] tracking-[0.1em]', className)}>
      <span className={cn('dot', m.dot)} />
      {m.label}
    </span>
  )
}

// ─── ShiftStatusBadge ────────────────────────────────────────────────────────
// Single badge component for shift completion status — uses STATUS_TOKENS as
// the sole source of truth. Import this instead of defining local status maps.
export function ShiftStatusBadge({ status }: { status: string }) {
  const t = getStatusToken(status)
  return (
    <span style={{
      background: t.bg,
      color: t.color,
      border: `1px ${t.dashed ? 'dashed' : 'solid'} ${t.border}`,
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: 9,
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
      padding: '3px 8px',
      display: 'inline-block',
      whiteSpace: 'nowrap',
    }}>
      {t.label}
    </span>
  )
}

// ─── ProgressBar ─────────────────────────────────────────────────────────────
interface ProgressBarProps {
  value: number      // 0–100
  max?: number
  variant?: 'ink' | 'mint' | 'orange'
  className?: string
}

export function ProgressBar({ value, max = 100, variant = 'mint', className }: ProgressBarProps) {
  const pct = Math.min((value / max) * 100, 100)
  const fillClass = { ink: 'bar-fill', mint: 'bar-fill bar-fill-mint', orange: 'bar-fill bar-fill-orange' }[variant]
  return (
    <div className={cn('bar', className)}>
      <span className={fillClass} style={{ width: `${pct}%` }} />
    </div>
  )
}

// ─── SectionHeader ───────────────────────────────────────────────────────────
// Page-level serif headline with kicker
interface SectionHeaderProps {
  kicker: string
  title: ReactNode
  sub?: ReactNode
  right?: ReactNode
  className?: string
}

export function SectionHeader({ kicker, title, sub, right, className }: SectionHeaderProps) {
  return (
    <div className={cn('flex items-end justify-between gap-8 px-10 pt-10 pb-6', className)}>
      <div className="flex-1">
        <Kicker leader className="mb-4">{kicker}</Kicker>
        <h1 className="font-serif text-[52px] leading-[0.98] font-medium tracking-[-0.02em]">{title}</h1>
        {sub && <p className="mt-3 text-[13px] text-ink-soft leading-relaxed max-w-xl">{sub}</p>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  )
}

// ─── Dashed divider ───────────────────────────────────────────────────────────
export function Divider({ className }: { className?: string }) {
  return <div className={cn('border-t border-dashed border-line-soft', className)} />
}
