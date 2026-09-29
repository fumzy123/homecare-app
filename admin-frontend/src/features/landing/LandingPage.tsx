import { useState } from 'react'
import { PricingCalculator } from './components/PricingCalculator'
import { LaunchFeatures } from './components/LaunchFeatures'
import { Link } from '@tanstack/react-router'
import { useAuthStore } from '@/shared/stores/auth'
import { Tag, Btn, Card, Kicker } from '@/shared/components/ui'
import heroImage from '@/assets/hero.png'
import schedulingPreview from '@/assets/scheduling.png'
import attendancePreview from '@/assets/attendance.png'
import timesheetsPreview from '@/assets/timesheets.png'
import progressNotesPreview from '@/assets/progress notes.png'

export function LandingPage() {
  const { accessToken } = useAuthStore()
  const [activeFeature, setActiveFeature] = useState(0)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const navLinks = [
    { label: 'Home',     href: '#home' },
    { label: 'Features', href: '#features' },
    { label: 'Pricing',  href: '#pricing' },
  ]

  return (
    <div className="min-h-screen bg-cream selection:bg-orange selection:text-white">

      {/* ── Navbar ────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 bg-cream/80 backdrop-blur-md border-b border-ink">
        <div className="px-10 max-md:px-6 py-4 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <svg width="24" height="24" viewBox="0 0 28 28" fill="none">
              <rect x="0.5" y="0.5" width="27" height="27" stroke="#111" />
              <path d="M 7 21 L 7 9 L 14 17 L 14 9 L 21 17 L 21 21" stroke="#111" strokeWidth="1.5" fill="none" />
              <circle cx="21" cy="7" r="2.5" fill="#FF5A1F" />
            </svg>
            <div>
              <p className="font-serif text-[16px] leading-none tracking-[-0.02em] font-medium">Homecare</p>
              <p className="font-mono text-[7px] tracking-[0.18em] uppercase text-ink-soft mt-0.5">Home Care OS</p>
            </div>
          </div>

          {/* Desktop nav links */}
          <div className="flex items-center gap-8 max-md:hidden">
            {navLinks.map(({ label, href }) => (
              <a key={label} href={href} className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft hover:text-ink transition-colors">
                {label}
              </a>
            ))}
          </div>

          {/* Right: CTA + hamburger */}
          <div className="flex items-center gap-4">
            {accessToken ? (
              <Link to="/dashboard">
                <Btn variant="primary" size="sm">Go to Dashboard</Btn>
              </Link>
            ) : (
              <>
                <Link to="/login" className="max-md:hidden">
                  <Btn variant="ghost" size="sm">Sign in</Btn>
                </Link>
                <Link to="/register" className="max-md:hidden">
                  <Btn variant="orange" size="sm">Get Started</Btn>
                </Link>
              </>
            )}
            {/* Hamburger — mobile only */}
            <button
              className="hidden max-md:flex flex-col gap-1.5 p-1"
              onClick={() => setMobileMenuOpen((o) => !o)}
              aria-label="Toggle menu"
            >
              <span className={`block w-5 h-px bg-ink transition-all duration-200 ${mobileMenuOpen ? 'rotate-45 translate-y-2' : ''}`} />
              <span className={`block w-5 h-px bg-ink transition-all duration-200 ${mobileMenuOpen ? 'opacity-0' : ''}`} />
              <span className={`block w-5 h-px bg-ink transition-all duration-200 ${mobileMenuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
            </button>
          </div>
        </div>

        {/* Mobile menu drawer */}
        {mobileMenuOpen && (
          <div className="hidden max-md:flex flex-col border-t border-ink bg-cream/95 backdrop-blur-md px-6 py-6 gap-5">
            {navLinks.map(({ label, href }) => (
              <a
                key={label}
                href={href}
                onClick={() => setMobileMenuOpen(false)}
                className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-soft hover:text-ink transition-colors"
              >
                {label}
              </a>
            ))}
            <div className="border-t border-line-soft pt-5 flex flex-col gap-3">
              {!accessToken && (
                <>
                  <Link to="/login" onClick={() => setMobileMenuOpen(false)}>
                    <Btn variant="ghost" size="sm" className="w-full justify-center">Sign in</Btn>
                  </Link>
                  <Link to="/register" onClick={() => setMobileMenuOpen(false)}>
                    <Btn variant="orange" size="sm" className="w-full justify-center">Get Started</Btn>
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </nav>

      {/* ── Hero Section ─────────────────────────────────────────────────── */}
      <header id="home" className="relative pt-20 pb-24 max-md:pt-12 max-md:pb-16 px-10 max-md:px-6 grid-bg border-b border-ink overflow-hidden">
        <div className="max-w-6xl mx-auto grid grid-cols-12 gap-12 max-md:gap-8 items-center">
          <div className="col-span-7 max-md:col-span-12">
            {/* <Kicker leader className="mb-6">The precision OS for care teams</Kicker> */}
            <h1 className="font-serif text-[84px] max-md:text-[48px] max-sm:text-[38px] leading-[0.9] font-medium tracking-[-0.03em] text-ink mb-8">
              Scheduling care<br />
              <span className="tape">without</span> the <br />
              spreadsheet.
            </h1>
            <p className="text-[18px] max-md:text-[16px] text-ink-soft leading-relaxed max-w-lg mb-10">
              Scheduling, client records, and team management for home care agencies. Start your 14-day trial and get personal help with onboarding whenever you need it.
            </p>
            <div className="flex items-center gap-4 max-sm:flex-col max-sm:items-start">
              <Link to="/register">
                <Btn variant="orange" className="px-8 py-3 text-[14px]">Get started</Btn>
              </Link>
              <p className="font-mono text-[10px] text-muted max-w-[140px] leading-tight">
                Onboarding included. No setup fees.
              </p>
            </div>
          </div>

          <div className="col-span-5 max-md:col-span-12 relative">
            <Card brackets className="p-2 bg-paper rotate-1 shadow-2xl">
              <img src={heroImage} alt="Homecare OS Dashboard Mockup" className="w-full grayscale-[0.2]" />
              <div className="absolute -top-6 -right-6">
                <Tag variant="orange" className="rotate-12 px-4 py-2 text-[12px]">Agency workspace</Tag>
              </div>
            </Card>
          </div>
        </div>
      </header>

      {/* ── Feature Ticker ───────────────────────────────────────────────── */}
      <section className="border-b border-ink py-10 bg-paper overflow-hidden">
        <div className="ticker-track">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center gap-10 shrink-0">
              {[
                { dot: true,  text: 'Visual shift scheduling' },
                { dot: false, text: '—' },
                { dot: true,  text: 'Office-managed attendance records' },
                { dot: false, text: '—' },
                { dot: true,  text: 'Scheduled-hours CSV export' },
                { dot: false, text: '—' },
                { dot: true,  text: 'Employee leave management' },
                { dot: false, text: '—' },
                { dot: true,  text: 'Client care-hour reporting' },
                { dot: false, text: '—' },
                { dot: true,  text: 'Progress note capture' },
                { dot: false, text: '—' },
              ].map((item, j) =>
                item.dot ? (
                  <span key={j} className="flex items-center gap-2.5 font-mono text-[11px] tracking-[0.08em] uppercase text-ink-soft whitespace-nowrap">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange shrink-0" />
                    {item.text}
                  </span>
                ) : (
                  <span key={j} className="text-line-soft font-mono text-[14px] select-none">—</span>
                )
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── Features Showcase ──────────────────────────────────────────────── */}
      <section id="features" className="py-24 max-md:py-16 px-10 max-md:px-6 max-w-7xl mx-auto border-b border-ink">
        <div className="flex flex-col items-center text-center mb-20 max-md:mb-12">
          <Kicker className="mb-4">Standardized Excellence</Kicker>
          <h2 className="font-serif text-[52px] max-md:text-[36px] max-sm:text-[28px] leading-none font-medium mb-6">Designed for scale. Built for speed.</h2>
          <p className="text-ink-soft max-w-2xl max-md:text-[14px]">
            We've distilled home care operations into a clean, technical blueprint. Stop fighting your tools and start managing your agency.
          </p>
        </div>

        <div className="grid grid-cols-12 gap-12 max-md:gap-6 items-start">
          {/* Left: Interactive cards */}
          <div className="col-span-5 max-md:col-span-12 flex flex-col gap-4">
            {[
              {
                id: 0,
                label: '[MODULE_01]',
                title: 'Visual Scheduling',
                desc: 'Plan recurring visits, review your calendar, and manage changes with conflict checks and overtime review.',
                img: schedulingPreview
              },
              {
                id: 1,
                label: '[MODULE_02]',
                title: 'Attendance Control',
                desc: 'Review visit statuses, record no-shows, and manage attendance from the office. Statuses do not verify a worker’s location or actual hours.',
                img: attendancePreview
              },
              {
                id: 2,
                label: '[MODULE_03]',
                title: 'Timesheet Export',
                desc: 'Export scheduled shift times and recorded statuses as CSV. Review and reconcile actual hours before using the export for payroll.',
                img: timesheetsPreview
              },
              {
                id: 3,
                label: '[MODULE_04]',
                title: 'Progress Notes',
                desc: 'Office staff can record and review progress notes for client visits. Worker mobile documentation is not part of the launch offer.',
                img: progressNotesPreview
              }
            ].map((f) => (
              <div
                key={f.id}
                onMouseEnter={() => setActiveFeature(f.id)}
                onTouchStart={() => setActiveFeature(f.id)}
                className={`transition-all duration-300 ${activeFeature === f.id ? 'opacity-100' : 'opacity-40'}`}
              >
                <Card brackets lift={activeFeature === f.id} className={`p-8 max-md:p-6 cursor-pointer ${activeFeature === f.id ? 'bg-paper border-ink' : 'bg-transparent border-ink/20'}`}>
                  <div className="font-mono text-[9px] text-muted mb-8 max-md:mb-4">{f.label}</div>
                  <h3 className="font-serif text-[28px] max-md:text-[22px] font-medium mb-3">{f.title}</h3>
                  <p className="text-ink-soft text-[14px] leading-relaxed">
                    {f.desc}
                  </p>
                </Card>
              </div>
            ))}
          </div>

          {/* Right: Visual preview — desktop only */}
          <div className="col-span-7 max-md:hidden sticky top-32">
            <div className="relative aspect-video">
              <Card brackets className="w-full h-full p-2 bg-paper overflow-hidden shadow-xl">
                <div className="relative w-full h-full bg-cream-2 border border-ink/10 flex items-center justify-center">
                  <img
                    src={[schedulingPreview, attendancePreview, timesheetsPreview, progressNotesPreview][activeFeature]}
                    alt="Feature Preview"
                    className="w-full h-full object-cover transition-opacity duration-500"
                    key={activeFeature}
                  />
                  <div className="absolute inset-0 pointer-events-none grid-bg opacity-20" />
                </div>
              </Card>
            </div>
          </div>
        </div>
      </section>

      <LaunchFeatures />
      <PricingCalculator />

      {/* ── CTA Section ─────────────────────────────────────────────────── */}
      <section className="bg-ink text-cream py-32 max-md:py-20 px-10 max-md:px-6 text-center border-y border-ink">
        <div className="max-w-3xl mx-auto">
          <Kicker className="justify-center mb-8 text-muted">Ready to upgrade?</Kicker>
          <h2 className="font-serif text-[64px] max-md:text-[40px] max-sm:text-[32px] leading-[1.0] font-medium mb-10">
            Ditch the spreadsheet.<br />
            Secure your agency's future.
          </h2>
          <div className="flex flex-col items-center gap-6">
            <Link to="/register">
              <Btn variant="orange" className="px-10 py-4 text-[16px]">Get Started Now</Btn>
            </Link>
            <p className="font-mono text-[10px] text-muted tracking-widest uppercase">
              Free 14-day trial · No setup fees · Cancel anytime
            </p>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="py-12 px-10 max-md:px-6 bg-paper border-t border-ink">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <svg width="20" height="20" viewBox="0 0 28 28" fill="none">
                <rect x="0.5" y="0.5" width="27" height="27" stroke="#111" />
                <path d="M 7 21 L 7 9 L 14 17 L 14 9 L 21 17 L 21 21" stroke="#111" strokeWidth="1.5" fill="none" />
                <circle cx="21" cy="7" r="2.5" fill="#FF5A1F" />
              </svg>
              <p className="font-serif text-[16px] font-medium">Homecare OS</p>
            </div>
            <p className="font-mono text-[9px] text-muted uppercase tracking-wider">
              Precision Engineered in Canada.
            </p>
          </div>

          <div className="flex gap-12 max-md:flex-col max-md:gap-6">
            <div>
              <p className="font-mono text-[9px] text-muted uppercase tracking-widest mb-4">Platform</p>
              <ul className="flex flex-col gap-2 font-mono text-[11px]">
                <li><a href="#features" className="hover:text-orange">Features</a></li>
              </ul>
            </div>
            <div>
              <p className="font-mono text-[9px] text-muted uppercase tracking-widest mb-4">Legal</p>
              <ul className="flex flex-col gap-2 font-mono text-[11px]">
                <li><Link to="/privacy" className="hover:text-orange">Privacy</Link></li>
                <li><Link to="/terms" className="hover:text-orange">Terms</Link></li>
              </ul>
            </div>
          </div>
        </div>
        <div className="mt-12 pt-8 border-t border-line-soft flex flex-wrap justify-between items-center gap-4 font-mono text-[9px] text-muted">
          <p>© {new Date().getFullYear()} Homecare Operating System Inc.</p>
          <p>BUILT_WITH_PRIDE_IN_CA</p>
        </div>
      </footer>
    </div>
  )
}
