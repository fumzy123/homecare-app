interface SettingsPaneHeaderProps {
  num:   string
  title: string
  sub:   string
}

export function SettingsPaneHeader({ num, title, sub }: SettingsPaneHeaderProps) {
  return (
    <div className="pb-6 mb-8 border-b border-ink">
      <p className="font-mono text-[9px] tracking-[0.12em] uppercase text-ink-soft mb-2">
        <span className="inline-block w-4 h-px bg-ink align-middle mr-2" />
        Section {num}
      </p>
      <h2 className="font-serif text-[38px] leading-none font-medium tracking-[-0.02em]">
        {title} <span className="font-serif italic text-muted">.</span>
      </h2>
      <p className="font-mono text-[11px] text-ink-soft mt-2 max-w-lg">{sub}</p>
    </div>
  )
}
