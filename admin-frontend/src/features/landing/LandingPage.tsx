import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useAuthStore } from '@/shared/stores/auth'
import { Btn, Card, Kicker, Tag } from '@/shared/components/ui'
import heroImage from '@/assets/hero.png'
import schedulingPreview from '@/assets/scheduling.png'
import attendancePreview from '@/assets/attendance.png'
import timesheetsPreview from '@/assets/timesheets.png'

export function LandingPage() {
  const { accessToken } = useAuthStore()
  const [activeFeature, setActiveFeature] = useState(0)

  return (
    <div className="min-h-screen bg-cream selection:bg-orange selection:text-white">
      {/* ── Navbar ────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 bg-cream/80 backdrop-blur-md border-b border-ink px-10 max-md:px-6 py-4 flex items-center justify-between">
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

        <div className="flex items-center gap-8 max-md:hidden">
          {['Product', 'Pricing', 'Company'].map((item) => (
            <a key={item} href="#" className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft hover:text-ink transition-colors">
              {item}
            </a>
          ))}
        </div>

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
              <Link to="/register">
                <Btn variant="orange" size="sm">Get Started</Btn>
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* ── Hero Section ─────────────────────────────────────────────────── */}
      <header className="relative pt-24 pb-32 px-10 max-md:px-6 grid-bg border-b border-ink overflow-hidden">
        <div className="max-w-6xl mx-auto grid grid-cols-12 gap-12 items-center">
          <div className="col-span-7 max-md:col-span-12">
            <Kicker leader className="mb-6">The precision OS for care teams</Kicker>
            <h1 className="font-serif text-[84px] max-md:text-[56px] leading-[0.9] font-medium tracking-[-0.03em] text-ink mb-8">
              Scheduling care — <br />
              <span className="tape">without</span> the <br />
              spreadsheet.
            </h1>
            <p className="text-[18px] text-ink-soft leading-relaxed max-w-lg mb-10">
              The modern operating system for home care agencies. Manage shifts, workers, and clients in one high-performance platform.
            </p>
            <div className="flex items-center gap-4">
              <Link to="/register">
                <Btn variant="orange" className="px-8 py-3 text-[14px]">Start your 14-day trial</Btn>
              </Link>
              <p className="font-mono text-[10px] text-muted max-w-[140px] leading-tight">
                No credit card required. Setup in 5 minutes.
              </p>
            </div>
          </div>

          <div className="col-span-5 max-md:col-span-12 relative">
            <Card brackets className="p-2 bg-paper rotate-1 shadow-2xl">
              <img src={heroImage} alt="Homecare OS Dashboard Mockup" className="w-full grayscale-[0.2]" />
              <div className="absolute -top-6 -right-6">
                <Tag variant="orange" className="rotate-12 px-4 py-2 text-[12px]">v1.0 Released</Tag>
              </div>
            </Card>
            {/* Blueprint marks */}
            <div className="absolute -bottom-10 -left-10 font-mono text-[10px] text-muted opacity-40 select-none">
              [SYSTEM_SPEC_2026]<br />
              REF_ID: 8D4985E
            </div>
          </div>
        </div>
      </header>

      {/* ── Trust Bar ────────────────────────────────────────────────────── */}
      <section className="border-b border-ink py-10 bg-paper overflow-hidden">
        <div className="ticker-track">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center gap-12 opacity-50">
              <span className="font-serif text-[24px] font-medium italic">CareFirst Ontario</span>
              <span className="font-serif text-[24px] font-medium italic">Vancouver Health</span>
              <span className="font-serif text-[24px] font-medium italic">Montreal Care Group</span>
              <span className="font-serif text-[24px] font-medium italic">Alberta Seniors</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features Showcase ──────────────────────────────────────────────── */}
      <section className="py-24 px-10 max-md:px-6 max-w-7xl mx-auto border-b border-ink">
        <div className="flex flex-col items-center text-center mb-20">
          <Kicker className="mb-4">Standardized Excellence</Kicker>
          <h2 className="font-serif text-[52px] leading-none font-medium mb-6">Designed for scale. Built for speed.</h2>
          <p className="text-ink-soft max-w-2xl">
            We've distilled home care operations into a clean, technical blueprint. Stop fighting your tools and start managing your agency.
          </p>
        </div>

        <div className="grid grid-cols-12 gap-12 items-start">
          {/* Left: Interactive cards */}
          <div className="col-span-5 max-md:col-span-12 flex flex-col gap-4">
            {[
              { 
                id: 0, 
                label: '[MODULE_01]', 
                title: 'Visual Scheduling', 
                desc: 'Visualize your entire agency\'s week in a precision grid. Drag, drop, and deploy care to the clients who need it most.',
                img: schedulingPreview
              },
              { 
                id: 1, 
                label: '[MODULE_02]', 
                title: 'Attendance Control', 
                desc: 'Know exactly who is on-site. Track no-shows and coverage gaps instantly with real-time status updates.',
                img: attendancePreview
              },
              { 
                id: 2, 
                label: '[MODULE_03]', 
                title: 'Automated Timesheets', 
                desc: 'No more manual calculations. Generate ready-to-bill timesheets directly from scheduled shifts with one click.',
                img: timesheetsPreview
              }
            ].map((f) => (
              <div 
                key={f.id}
                onMouseEnter={() => setActiveFeature(f.id)}
                className={`transition-all duration-300 ${activeFeature === f.id ? 'opacity-100' : 'opacity-40'}`}
              >
                <Card brackets lift={activeFeature === f.id} className={`p-8 cursor-pointer ${activeFeature === f.id ? 'bg-paper border-ink' : 'bg-transparent border-ink/20'}`}>
                  <div className="font-mono text-[9px] text-muted mb-8">{f.label}</div>
                  <h3 className="font-serif text-[28px] font-medium mb-3">{f.title}</h3>
                  <p className="text-ink-soft text-[14px] leading-relaxed">
                    {f.desc}
                  </p>
                </Card>
              </div>
            ))}
          </div>

          {/* Right: Visual preview */}
          <div className="col-span-7 max-md:hidden sticky top-32">
            <div className="relative aspect-video">
              <Card brackets className="w-full h-full p-2 bg-paper overflow-hidden shadow-xl">
                <div className="relative w-full h-full bg-cream-2 border border-ink/10 flex items-center justify-center">
                  <img 
                    src={[schedulingPreview, attendancePreview, timesheetsPreview][activeFeature]} 
                    alt="Feature Preview" 
                    className="w-full h-full object-cover transition-opacity duration-500"
                    key={activeFeature}
                  />
                  
                  {/* Technical Overlay */}
                  <div className="absolute inset-0 pointer-events-none grid-bg opacity-20" />
                  <div className="absolute bottom-4 left-4 font-mono text-[9px] text-muted flex gap-4">
                    <span>POS_X: 104.2</span>
                    <span>POS_Y: 88.1</span>
                    <span>REF: LIVE_SYNC</span>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA Section ─────────────────────────────────────────────────── */}
      <section className="bg-ink text-cream py-32 px-10 max-md:px-6 text-center border-y border-ink">
        <div className="max-w-3xl mx-auto">
          <Kicker className="justify-center mb-8 text-muted">Ready to upgrade?</Kicker>
          <h2 className="font-serif text-[64px] max-md:text-[42px] leading-[1.0] font-medium mb-10">
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
                <li><a href="#" className="hover:text-orange">Features</a></li>
                <li><a href="#" className="hover:text-orange">Security</a></li>
                <li><a href="#" className="hover:text-orange">API</a></li>
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
        <div className="mt-12 pt-8 border-t border-line-soft flex justify-between items-center font-mono text-[9px] text-muted">
          <p>© {new Date().getFullYear()} Homecare Operating System Inc.</p>
          <p>BUILT_WITH_PRIDE_IN_CA</p>
        </div>
      </footer>
    </div>
  )
}
