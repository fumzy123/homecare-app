import { type ReactNode, type ButtonHTMLAttributes, useState, useRef, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react'
import {
  format, parse, addDays, addMonths, subMonths,
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  isSameDay, isSameMonth, isToday,
} from 'date-fns'
import { WEEK_STARTS_ON } from '@/shared/lib/date'
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

// ─── DateInput ────────────────────────────────────────────────────────────────
// Custom date picker that matches the design system.
// value / onChange use 'yyyy-MM-dd' strings, same API as <input type="date">.

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

interface DateInputProps {
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  min?: string
  max?: string
  placeholder?: string
  className?: string
}

export function DateInput({ value, onChange, onBlur, min, max, placeholder = 'Select date', className }: DateInputProps) {
  const [open, setOpen]         = useState(false)
  const [viewDate, setViewDate] = useState<Date>(() =>
    value ? parse(value, 'yyyy-MM-dd', new Date()) : new Date()
  )
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        onBlur?.()
      }
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [open, onBlur])

  useEffect(() => {
    if (value) setViewDate(parse(value, 'yyyy-MM-dd', new Date()))
  }, [value])

  const selected = value ? parse(value, 'yyyy-MM-dd', new Date()) : null
  const minDate  = min ? parse(min, 'yyyy-MM-dd', new Date()) : null
  const maxDate  = max ? parse(max, 'yyyy-MM-dd', new Date()) : null

  function buildDays(): Date[] {
    const start = startOfWeek(startOfMonth(viewDate), { weekStartsOn: WEEK_STARTS_ON })
    const end   = endOfWeek(endOfMonth(viewDate),     { weekStartsOn: WEEK_STARTS_ON })
    const days: Date[] = []
    let cur = start
    while (cur <= end) { days.push(cur); cur = addDays(cur, 1) }
    return days
  }

  function disabled(day: Date) {
    return (minDate != null && day < minDate) || (maxDate != null && day > maxDate)
  }

  function select(day: Date) {
    if (disabled(day)) return
    onChange(format(day, 'yyyy-MM-dd'))
    setOpen(false)
    onBlur?.()
  }

  function goToday() {
    const today = new Date()
    setViewDate(today)
    if (!disabled(today)) { onChange(format(today, 'yyyy-MM-dd')); setOpen(false); onBlur?.() }
  }

  const displayValue = selected ? format(selected, 'MMM d, yyyy') : ''
  const days = buildDays()

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="bg-paper border border-ink px-3 py-2 font-mono text-[11px] text-ink focus:outline-none focus:ring-1 focus:ring-ink w-full text-left flex items-center justify-between gap-2"
      >
        <span className={displayValue ? 'text-ink' : 'text-ink-soft'}>{displayValue || placeholder}</span>
        <Calendar size={12} className="text-ink-soft shrink-0" />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-paper border border-ink p-4 w-64 shadow-sm">
          {/* Month navigation */}
          <div className="flex items-center justify-between mb-3">
            <button type="button" onClick={() => setViewDate(d => subMonths(d, 1))} className="p-1 hover:bg-cream-2 transition-colors">
              <ChevronLeft size={13} />
            </button>
            <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink">
              {format(viewDate, 'MMMM yyyy')}
            </span>
            <button type="button" onClick={() => setViewDate(d => addMonths(d, 1))} className="p-1 hover:bg-cream-2 transition-colors">
              <ChevronRight size={13} />
            </button>
          </div>

          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAY_LABELS.map(d => (
              <div key={d} className="text-center font-mono text-[9px] uppercase tracking-[0.06em] text-ink-soft py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7">
            {days.map((day, i) => {
              const sel      = selected != null && isSameDay(day, selected)
              const inMonth  = isSameMonth(day, viewDate)
              const todayDay = isToday(day)
              const dis      = disabled(day)
              return (
                <button
                  key={i}
                  type="button"
                  disabled={dis}
                  onClick={() => select(day)}
                  className={cn(
                    'h-8 w-full font-mono text-[11px] transition-colors',
                    sel      ? 'bg-ink text-cream'
                    : todayDay ? 'border border-ink text-ink hover:bg-cream-2'
                    :            'hover:bg-cream-2 text-ink',
                    !inMonth && 'opacity-30',
                    dis      && 'opacity-20 cursor-not-allowed',
                  )}
                >
                  {format(day, 'd')}
                </button>
              )
            })}
          </div>

          {/* Footer */}
          <div className="flex justify-between mt-3 pt-3 border-t border-dashed border-line-soft">
            <button
              type="button"
              onClick={() => { onChange(''); setOpen(false); onBlur?.() }}
              className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-soft hover:text-ink transition-colors"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={goToday}
              className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-soft hover:text-ink transition-colors"
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
