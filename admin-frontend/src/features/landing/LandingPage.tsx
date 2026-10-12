import { useEffect, useRef, useState } from 'react'
import { useAuthStore } from '@/shared/stores/auth'
import { LandingHeader } from './components/LandingHeader'
import { LandingHero } from './components/LandingHero'
import { LandingPrinciples } from './components/LandingPrinciples'
import { FeatureOverview } from './components/FeatureOverview'
import { SchedulingDemo } from './components/SchedulingDemo'
import { LaunchFeatures } from './components/LaunchFeatures'
import { PricingCalculator } from './components/PricingCalculator'
import { LandingFaq } from './components/LandingFaq'
import { LandingCallToAction } from './components/LandingCallToAction'
import { LandingFooter } from './components/LandingFooter'
import type { PreviewView } from './types'
import './landing.css'

// Layer 4: public page composition and account-aware navigation.
export function LandingPage() {
  const signedIn = useAuthStore((state) => Boolean(state.accessToken))
  const startPath = signedIn ? '/dashboard' : '/register'
  const [view, setView] = useState<PreviewView>('schedule')
  const [demoVersion, setDemoVersion] = useState(0)
  const root = useRef<HTMLDivElement>(null)

  function openAnnualFaq() {
    const faq = root.current?.querySelector<HTMLDetailsElement>(
      '#annual-clients-faq',
    )
    if (faq) faq.open = true
  }
  useEffect(() => {
    function revealLinkedFaq() {
      if (window.location.hash === '#annual-clients-faq') {
        const faq = root.current?.querySelector<HTMLDetailsElement>(
          '#annual-clients-faq',
        )
        if (faq) {
          faq.open = true
          faq.scrollIntoView({ block: 'start' })
        }
      }
    }
    revealLinkedFaq()
    window.addEventListener('hashchange', revealLinkedFaq)
    return () => window.removeEventListener('hashchange', revealLinkedFaq)
  }, [])

  function explore(next: PreviewView) {
    setView(next)
    root.current
      ?.querySelector<HTMLElement>(`#tab-${next}`)
      ?.focus({ preventScroll: true })
    root.current
      ?.querySelector('#workspace')
      ?.scrollIntoView({ block: 'start' })
  }
  function tryShift() {
    setDemoVersion((version) => version + 1)
    requestAnimationFrame(() => {
      root.current
        ?.querySelector('#scheduling-demo')
        ?.scrollIntoView({ block: 'start' })
      root.current
        ?.querySelector<HTMLElement>('#worker-select')
        ?.focus({ preventScroll: true })
    })
  }

  return (
    <div className="care-landing" ref={root}>
      <title>Care Harbor — Schedule care without the paperwork.</title>
      <meta
        name="description"
        content="Bring schedules, client records, and your care team together. Home care management software with personal onboarding and a 14-day trial."
      />
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <LandingHeader startPath={startPath} />
      <main id="main">
        <LandingHero view={view} onViewChange={setView} onAddShift={tryShift} />
        <LandingPrinciples />
        <FeatureOverview onExplore={explore} />
        <SchedulingDemo key={demoVersion} />
        <LaunchFeatures />
        <PricingCalculator
          startPath={startPath}
          onOpenAnnualFaq={openAnnualFaq}
        />
        <LandingFaq />
        <LandingCallToAction startPath={startPath} />
      </main>
      <LandingFooter />
    </div>
  )
}
