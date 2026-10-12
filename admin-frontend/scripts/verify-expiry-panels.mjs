import assert from 'node:assert/strict'
import path from 'node:path'
import { createServer } from 'vite'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const server = await createServer({ configFile: false, server: { middlewareMode: true }, resolve: { alias: { '@': path.resolve('src') } } })
try {
  const { ComplianceAlertsPanel } = await server.ssrLoadModule('/src/features/workers/components/ComplianceAlertsPanel.tsx')
  const { AuthorizationsExpiringPanel } = await server.ssrLoadModule('/src/features/authorizations/components/AuthorizationsExpiringPanel.tsx')
  for (const [Component, key, label] of [[ComplianceAlertsPanel, 'expiring-credentials', 'credential'], [AuthorizationsExpiringPanel, 'expiring-authorizations', 'authorization']]) {
    for (const status of ['pending', 'error', 'success']) {
      const client = new QueryClient({ defaultOptions: { queries: { retry: false, retryOnMount: false } } })
      if (status === 'success') client.setQueryData([key], [])
      if (status === 'error') client.getQueryCache().build(client, { queryKey: [key] }, {
        data: undefined, dataUpdateCount: 0, dataUpdatedAt: 0, error: new Error('Unavailable'),
        errorUpdateCount: 1, errorUpdatedAt: Date.now(), fetchFailureCount: 1, fetchFailureReason: null,
        fetchMeta: null, isInvalidated: false, status: 'error', fetchStatus: 'idle',
      })
      const html = renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(Component)))
      assert.doesNotMatch(html, /All .* valid|NO ACTION NEEDED/)
      if (status === 'pending') assert.match(html, new RegExp(`Checking upcoming ${label}`))
      if (status === 'error') { assert.match(html, /role="alert"/); assert.match(html, /Retry/); assert.doesNotMatch(html, /None found/) }
      if (status === 'success') { assert.match(html, /None found in the next/); assert.match(html, /missing or already expired/) }
      client.clear()
    }
  }
  console.log('Expiry panel checks passed: loading and errors never report compliance, and empty windows are qualified.')
} finally {
  await server.close()
}
