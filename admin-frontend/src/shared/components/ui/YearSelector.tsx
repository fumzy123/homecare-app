interface YearSelectorProps {
  year: number
  onChange: (year: number) => void
  count?: number
}

export function YearSelector({ year, onChange, count = 5 }: YearSelectorProps) {
  const currentYear = new Date().getFullYear()
  const options = Array.from({ length: count }, (_, i) => currentYear - i)

  return (
    <div className="flex items-center gap-2">
      {options.map((y) => (
        <button
          key={y}
          onClick={() => onChange(y)}
          className={`px-3.5 py-1.5 font-mono text-[10px] tracking-[0.05em] uppercase transition-colors border ${
            year === y
              ? 'bg-ink text-cream border-ink'
              : 'border-ink text-ink-soft hover:text-ink hover:bg-cream-2'
          }`}
        >
          {y}
        </button>
      ))}
    </div>
  )
}
