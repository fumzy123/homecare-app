import assert from 'node:assert/strict'
import path from 'node:path'
import { createServer } from 'vite'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// Render the real journey with controlled auth/API states. Never consume real
// invitation tokens or change an account while testing return-to-setup behavior.
const mocks = {
  '../hooks/useInvitationAccount': 'export const useInvitationAccount = () => globalThis.__invitationAccount',
  '../api': 'export const authApi = { signIn: async () => {}, signOut: async () => {} }',
  './AcceptInviteForm': 'import { createElement } from "react"; export const AcceptInviteForm = () => createElement("form", null, "Worker profile setup")',
  '@tanstack/react-router': 'import { createElement } from "react"; export const Link = ({to, children, ...props}) => createElement("a", {...props, href: to}, children)',
}
const server = await createServer({
  configFile: false,
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true },
  ssr: { noExternal: ['@tanstack/react-router'] },
  resolve: { alias: { '@': path.resolve('src') } },
  plugins: [{
    name: 'invitation-state-fixtures',
    enforce: 'pre',
    resolveId(source, importer) {
      if (importer?.endsWith('/InvitationJourney.tsx') && Object.hasOwn(mocks, source)) return '\0fixture:' + source
    },
    load(id) { if (id.startsWith('\0fixture:')) return mocks[id.slice('\0fixture:'.length)] },
  }],
})
const previousWindow = globalThis.window
try {
  const { InvitationJourney } = await server.ssrLoadModule('/src/features/auth/components/InvitationJourney.tsx')
  const render = (overrides = {}, hash = '#error=access_denied&error_code=otp_expired') => {
    globalThis.window = { location: { hash, search: '' } }
    globalThis.__invitationAccount = {
      session: { user: { id: 'invited-worker', email: 'worker@example.test' } },
      loadingSession: false,
      sessionError: false,
      account: { data: { status: 'pending', org_name: 'Test Agency', email: 'worker@example.test' } },
      ...overrides,
    }
    return renderToStaticMarkup(createElement(InvitationJourney))
  }
  const pending = render()
  assert.match(pending, /Worker profile setup/)
  assert.doesNotMatch(pending, /link cannot be used/)
  assert.match(render({}, ''), /Worker profile setup/)
  assert.match(render({ loadingSession: true }), /Checking your agency invitation/)
  assert.match(render({ account: { isPending: true } }), /Checking your agency invitation/)
  assert.match(render({ account: { isError: true } }), /We could not check your invitation/)
  const active = render({ account: { data: { status: 'active', role: 'home_support_worker' } } })
  assert.match(active, /Account ready/)
  assert.doesNotMatch(active, /Worker profile setup|link cannot be used/)
  const expired = render({ account: { data: { status: 'expired' } } })
  assert.match(expired, /Your invitation has expired/)
  assert.doesNotMatch(expired, /Worker profile setup/)
  const noAccess = render({ account: { data: { status: 'no_access' } } })
  assert.match(noAccess, /No active invitation found/)
  assert.doesNotMatch(noAccess, /Worker profile setup/)
  const signedOut = render({ session: null })
  assert.match(signedOut, /link cannot be used/)
  assert.match(signedOut, /Continue setup/)
  assert.match(signedOut, /same browser/)
  console.log('Invitation resume checks passed: repeat click, first visit, loading, API failure, active, expired, no access, signed out.')
} finally {
  globalThis.window = previousWindow
  delete globalThis.__invitationAccount
  await server.close()
}
