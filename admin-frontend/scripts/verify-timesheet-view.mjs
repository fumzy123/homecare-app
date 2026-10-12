import assert from 'node:assert/strict'
import path from 'node:path'
import { createServer } from 'vite'
import { createTable, getCoreRowModel, getSortedRowModel } from '@tanstack/react-table'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const server = await createServer({ configFile: false, server: { middlewareMode: true }, resolve: { alias: { '@': path.resolve('src') } } })
try {
  const { shiftsApi } = await server.ssrLoadModule('/src/features/shifts/api.ts')
  const { timesheetQueryOptions } = await server.ssrLoadModule('/src/features/shifts/hooks/useTimesheetShifts.ts')
  const { filterTimesheetStatus, exportTimesheetView, buildTimesheetCsv } = await server.ssrLoadModule('/src/features/shifts/utils/timesheet.ts')
  const make = (id, date, worker, client, status) => ({ shift_id: id, date, worker: { id: worker, first_name: worker, last_name: id },
    client: { id: client, first_name: client, last_name: id }, completion_status: status,
    start_time: `${date}T09:00:00`, end_time: `${date}T11:00:00` })
  const all = [make('late', '2026-09-29', 'w1', 'c1', 'completed'), make('early', '2026-09-28', 'w1', 'c1', 'completed'),
    make('absent', '2026-09-28', 'w1', 'c1', 'no_show'), make('other-worker', '2026-09-28', 'w2', 'c1', 'completed'),
    make('other-client', '2026-09-28', 'w1', 'c2', 'completed'), make('outside', '2026-09-27', 'w1', 'c1', 'completed'),
    make('scheduled', '2026-09-28', 'w1', 'c1', 'scheduled')]
  const originalList = shiftsApi.listShifts
  let received
  shiftsApi.listShifts = async (...args) => {
    received = args
    const [from, to, worker, client, statuses] = args
    return all.filter(r => r.date >= from && r.date <= to && (!worker || r.worker.id === worker) && (!client || r.client.id === client) && statuses.includes(r.completion_status))
  }
  try {
    const options = timesheetQueryOptions('user1', '2026-09-28', '2026-09-29', 'w1', 'c1')
    const rows = await options.queryFn()
    assert.deepEqual(received, ['2026-09-28', '2026-09-29', 'w1', 'c1', ['completed', 'no_show', 'cancelled']])
    assert.deepEqual(rows.map(r => r.shift_id), ['late', 'early', 'absent'])
    assert.notDeepEqual(options.queryKey, timesheetQueryOptions('user1', '2026-09-28', '2026-09-29', 'w2', 'c1').queryKey)
    assert.notDeepEqual(options.queryKey, timesheetQueryOptions('user2', '2026-09-28', '2026-09-29', 'w1', 'c1').queryKey)
    assert.equal(timesheetQueryOptions(undefined, '', '', '', '').enabled, false)
    await timesheetQueryOptions('user1', '', '', '', '').queryFn()
    assert.deepEqual(received.slice(0, 4), ['2020-01-01', '2030-12-31', undefined, undefined])

    const filtered = filterTimesheetStatus(rows, 'completed')
    assert.deepEqual(filtered.map(r => r.shift_id), ['late', 'early'])
    assert.equal(filterTimesheetStatus(rows, 'cancelled').length, 0)
    assert.equal(filterTimesheetStatus(rows, '').length, 3)
    const table = createTable({ data: filtered, columns: [{ accessorKey: 'date' }], state: { sorting: [{ id: 'date', desc: false }] },
      getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel(), onStateChange() {}, renderFallbackValue: null })
    const original = { document: globalThis.document, create: URL.createObjectURL, revoke: URL.revokeObjectURL, timer: globalThis.setTimeout }
    let blob
    try {
      globalThis.document = { createElement: () => ({ click() {}, remove() {} }), body: { appendChild() {} } }
      URL.createObjectURL = b => { blob = b; return 'blob:test' }
      URL.revokeObjectURL = () => {}
      globalThis.setTimeout = () => 0
      exportTimesheetView(table, '2026-09-28', '2026-09-29')
      assert.deepEqual(table.getRowModel().rows.map(r => r.original.shift_id), ['early', 'late'])
      const csv = Buffer.from(await blob.arrayBuffer()).toString('utf8')
      assert.equal(csv, buildTimesheetCsv([all[1], all[0]]))
      assert.doesNotMatch(csv, /other-worker|other-client|outside|absent|scheduled/)
      table.setOptions(o => ({ ...o, state: { sorting: [{ id: 'date', desc: true }] } }))
      exportTimesheetView(table, '', '')
      assert.equal(Buffer.from(await blob.arrayBuffer()).toString('utf8'), buildTimesheetCsv([all[0], all[1]]))
    } finally {
      globalThis.document = original.document; URL.createObjectURL = original.create
      URL.revokeObjectURL = original.revoke; globalThis.setTimeout = original.timer
    }
  } finally { shiftsApi.listShifts = originalList }

  const { TimesheetTable } = await server.ssrLoadModule('/src/features/shifts/components/TimesheetTable.tsx')
  for (const status of ['pending', 'error', 'success', 'refreshing', 'ready']) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, retryOnMount: false } } })
    client.setQueryData(['workers'], []); client.setQueryData(['clients'], [])
    const key = timesheetQueryOptions(undefined, '2026-09-28', '2026-09-29', '', '').queryKey
    if (status === 'success') client.setQueryData(key, [])
    if (status === 'refreshing' || status === 'ready') client.setQueryData(key, [all[0], all[1]])
    if (status === 'refreshing') client.getQueryCache().find({ queryKey: key }).setState({ fetchStatus: 'fetching' })
    if (status === 'error') client.getQueryCache().build(client, { queryKey: key }, { data: undefined, dataUpdateCount: 0, dataUpdatedAt: 0,
      error: new Error('Unavailable'), errorUpdateCount: 1, errorUpdatedAt: Date.now(), fetchFailureCount: 1,
      fetchFailureReason: null, fetchMeta: null, isInvalidated: false, status: 'error', fetchStatus: 'idle' })
    const html = renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(TimesheetTable, {
      fromDate: '2026-09-28', toDate: '2026-09-29', onFromChange() {}, onToChange() {},
    })))
    if (status !== 'ready') assert.match(html, /disabled=""[^>]*>.*?Export filtered CSV/s)
    else {
      assert.doesNotMatch(html, /disabled=""[^>]*>.*?Export filtered CSV/s)
      assert.ok(html.indexOf('w1 early') < html.indexOf('w1 late'))
    }
    if (status === 'pending') assert.match(html, /LOADING/)
    if (status === 'error') { assert.match(html, /Could not load shifts/); assert.doesNotMatch(html, /NO SHIFTS MATCH/) }
    if (status === 'success') assert.match(html, /NO SHIFTS MATCH THESE FILTERS/)
    if (status === 'refreshing') assert.match(html, /Refreshing shifts/)
    client.clear()
  }
  console.log('Timesheet view checks passed: combined filters, cache isolation, sorted CSV rows, and disabled export on loading/error/empty views.')
} finally { await server.close() }
