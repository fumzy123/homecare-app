import assert from 'node:assert/strict'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { createServer } from 'vite'

// Read exported CSV using Python's independent standard-library parser.
function parse(csv) {
  const python = process.platform === 'win32' ? '../backend/.venv/Scripts/python.exe' : '../backend/.venv/bin/python'
  const result = spawnSync(python, ['-c', 'import csv,io,json,sys; print(json.dumps(list(csv.reader(io.StringIO(sys.stdin.buffer.read().decode("utf-8-sig"), newline="")))))'], { input: csv, encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr || result.error?.message)
  return JSON.parse(result.stdout)
}

const server = await createServer({ configFile: false, server: { middlewareMode: true }, resolve: { alias: { '@': path.resolve('src') } } })
try {
  const { serializeCsv } = await server.ssrLoadModule('/src/shared/lib/csv.ts')
  const normal = ['Smith, Jane', 'A "quoted" name', 'First\nSecond', 'First\r\nSecond', 'Élodie 李', "O'Neil", '', null, 1.25, -2]
  assert.deepEqual(parse(serializeCsv([normal]))[0], normal.map(v => v === null ? '' : String(v)))
  const formulas = ['=1+1', '+SUM(A1:A2)', '-1+2', '@SUM(A1)', '\tformula', '\rformula', '\nformula', ' \t=1', '\u0000=1', '＝1+1', '＋1', '－1', '＠SUM(A1)']
  assert.deepEqual(parse(serializeCsv([formulas]))[0], formulas.map(v => "'" + v))
  const escapedAttack = 'name",=1+1,"other'
  assert.deepEqual(parse(serializeCsv([[escapedAttack, 'safe']])), [[escapedAttack, 'safe']])

  const { buildTimesheetCsv, exportCsv } = await server.ssrLoadModule('/src/features/shifts/utils/timesheet.ts')
  const row = { date: '2026-09-28', start_time: '2026-09-28T22:00:00Z', end_time: '2026-09-29T02:30:00Z',
    worker: { first_name: 'Élodie, "Jane"', last_name: "O'Neil" }, client: { first_name: '=1+1', last_name: 'Example' }, completion_status: 'completed' }
  const rows = [row, { ...row, completion_status: 'no_show' }, { ...row, completion_status: 'cancelled' }]
  const csv = buildTimesheetCsv(rows)
  assert.ok(csv.startsWith('\uFEFF'))
  assert.ok(csv.endsWith('\r\n'))
  const parsed = parse(csv)
  assert.deepEqual(parsed[0], ['Date', 'Worker', 'Client', 'Start', 'End', 'Hours', 'Status'])
  assert.ok(parsed.every(r => r.length === 7))
  assert.equal(parsed[1][1], 'Élodie, "Jane" O\'Neil')
  assert.equal(parsed[1][2], "'=1+1 Example")
  assert.deepEqual(parsed.slice(1).map(r => r[5]), ['4.50', '0.00', '0.00'])
  assert.equal(row.client.first_name, '=1+1') // Stored/displayed source data is untouched.
  assert.equal(parse(buildTimesheetCsv([])).length, 1)

  const original = { document: globalThis.document, create: URL.createObjectURL, revoke: URL.revokeObjectURL, timer: globalThis.setTimeout }
  let blob, cleanup, clicked = false, removed = false, revoked = false, failClick = false
  const anchor = { click() { if (failClick) throw new Error('download failed'); clicked = true }, remove() { removed = true } }
  try {
    globalThis.document = { createElement: () => anchor, body: { appendChild(a) { assert.equal(a, anchor) } } }
    URL.createObjectURL = value => { blob = value; return 'blob:test' }
    URL.revokeObjectURL = value => { assert.equal(value, 'blob:test'); revoked = true }
    globalThis.setTimeout = callback => { cleanup = callback; return 0 }
    exportCsv(rows, '2026-09-28', '2026-09-29')
    assert.equal(anchor.download, 'timesheet-2026-09-28-to-2026-09-29.csv')
    assert.equal(blob.type, 'text/csv;charset=utf-8')
    assert.ok(clicked && removed && !revoked)
    assert.deepEqual(parse(Buffer.from(await blob.arrayBuffer()).toString('utf8')), parsed)
    cleanup()
    assert.ok(revoked)
    failClick = true; removed = false; revoked = false
    assert.throws(() => exportCsv(rows, 'from', 'to'), /download failed/)
    assert.ok(removed)
    cleanup()
    assert.ok(revoked)
  } finally {
    globalThis.document = original.document
    URL.createObjectURL = original.create
    URL.revokeObjectURL = original.revoke
    globalThis.setTimeout = original.timer
  }
  console.log('Timesheet CSV checks passed: quoting, Unicode, formula-like text, hours, empty export, and download cleanup.')
} finally {
  await server.close()
}
