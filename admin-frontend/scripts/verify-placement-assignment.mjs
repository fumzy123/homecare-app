import assert from 'node:assert/strict'
import path from 'node:path'
import { createServer } from 'vite'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const server = await createServer({ configFile: false, server: { middlewareMode: true }, resolve: { alias: { '@': path.resolve('src') } } })
try {
  const { AssignmentReview } = await server.ssrLoadModule('/src/features/placements/components/DirectAssignmentPanel.tsx')
  const preview = { employment_id: 'worker', worker_name: 'Alex <Worker>', eligibility: { all_clear: true, reasons: [] } }
  const render = value => renderToStaticMarkup(createElement(AssignmentReview, { preview: value, busy: false, onConfirm() { throw new Error('Rendering must not assign') } }))
  const eligible = render(preview)
  assert.match(eligible, /Alex &lt;Worker&gt;/)
  assert.match(eligible, /type="checkbox"/)
  assert.match(eligible, /<button[^>]*disabled=""/)
  assert.match(eligible, /checked again when you assign/)
  const blocked = render({ ...preview, eligibility: { all_clear: false, reasons: ['Already scheduled', 'Availability missing'] } })
  assert.match(blocked, /Already scheduled/)
  assert.match(blocked, /Availability missing/)
  assert.doesNotMatch(blocked, /<button|type="checkbox"/)
  console.log('Placement assignment review rendering checks passed')
} finally {
  await server.close()
}
