interface PeriodOption<T extends string> {
  key: T
  label: string
}

interface PeriodToggleProps<T extends string> {
  options: PeriodOption<T>[]
  value: T
  onChange: (value: T) => void
}

export function PeriodToggle<T extends string>({ options, value, onChange }: PeriodToggleProps<T>) {
  return (
    <div className="flex items-center gap-2">
      {options.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={`px-3.5 py-1.5 font-mono text-[10px] tracking-[0.05em] uppercase transition-colors border ${
            value === key
              ? 'bg-ink text-cream border-ink'
              : 'border-ink text-ink-soft hover:text-ink hover:bg-cream-2'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
