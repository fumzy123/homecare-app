import { useEffect, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { LandingBrand } from './LandingBrand'

// Layer 2: navigation UI; the page supplies the account-aware destination.
export function LandingHeader({
  startPath,
}: {
  startPath: '/register' | '/dashboard'
}) {
  const [open, setOpen] = useState(false)
  const menuButton = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!open) return
    function onEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
        menuButton.current?.focus()
      }
    }
    document.addEventListener('keydown', onEscape)
    return () => document.removeEventListener('keydown', onEscape)
  }, [open])
  const links = (
    <>
      <a href="#workspace">The workspace</a>
      <a href="#difference">Why Care Harbor</a>
      <a href="#pricing">Pricing</a>
    </>
  )
  return (
    <header className="site-header">
      <div className="nav-wrap">
        <LandingBrand />
        <nav className="desktop-nav" aria-label="Main navigation">
          {links}
        </nav>
        <div className="landing-account-nav">
          {startPath === '/register' && (
            <Link to="/login" className="sign-in-link">
              Sign in
            </Link>
          )}
          <Link to={startPath} className="button small nav-cta">
            {startPath === '/dashboard' ? 'Dashboard' : 'Let’s get started'}{' '}
            <span aria-hidden="true">↗</span>
          </Link>
        </div>
        <button
          ref={menuButton}
          type="button"
          className="menu-toggle"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpen((value) => !value)}
        >
          <span />
          <span />
        </button>
      </div>
      <nav
        id="mobile-nav"
        aria-label="Mobile navigation"
        hidden={!open}
        onClick={(event) => {
          if ((event.target as HTMLElement).closest('a')) setOpen(false)
        }}
      >
        {links}
        {startPath === '/register' && <Link to="/login">Sign in</Link>}
        <Link to={startPath}>
          {startPath === '/dashboard' ? 'Go to dashboard' : 'Get started'} ↗
        </Link>
      </nav>
    </header>
  )
}
