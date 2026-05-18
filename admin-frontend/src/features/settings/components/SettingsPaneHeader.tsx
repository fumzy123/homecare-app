interface SettingsPaneHeaderProps {
  title: string
  sub:   string
}

export function SettingsPaneHeader({ title, sub }: SettingsPaneHeaderProps) {
  return (
    <div className="pb-6 mb-8 border-b border-ink">
      <h2 className="font-serif text-[38px] leading-none font-medium tracking-[-0.02em]">
        {title} <span className="font-serif italic text-muted">.</span>
      </h2>
      <p className="font-mono text-[11px] text-ink-soft mt-2 max-w-lg">{sub}</p>
    </div>
  )
}
