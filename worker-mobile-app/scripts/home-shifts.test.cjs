const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const ts = require('typescript');
const compiled = ts.transpileModule(readFileSync(require.resolve('../src/features/home/lib/partitionShifts.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const exportsForTest = {};
new Function('exports', compiled)(exportsForTest);
const { partitionShifts } = exportsForTest;
// Load the pure home projection with its relative TypeScript dependencies.
const path = require('node:path');
function loadTs(filename) {
  const module = { exports: {} };
  const output = ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  new Function('require', 'exports', 'module', output)(
    name => loadTs(path.resolve(path.dirname(filename), `${name}.ts`)), module.exports, module,
  );
  return module.exports;
}
const { homeDateRange, homeSummary } = loadTs(require.resolve('../src/features/home/lib/homeSummary.ts'));
const shift = (id, start, end, status = 'scheduled') => ({
  shift_id: id, start_time: `2026-09-30T${start}:00`, end_time: `2026-09-30T${end}:00`, completion_status: status,
});
const at = (time) => Date.parse(`2026-09-30T${time}:00`);

test('current and next are distinct, chronological, and do not mutate API data', () => {
  const shifts = [shift('later', '20:00', '21:00'), shift('next', '19:00', '20:00'), shift('current', '18:00', '19:00')];
  const result = partitionShifts(shifts, at('18:30'));
  assert.equal(result.current.shift_id, 'current');
  assert.equal(result.next.shift_id, 'next');
  assert.deepEqual(result.later.map(s => s.shift_id), ['later']);
  assert.equal(result.nextIndex, 2);
  assert.equal(shifts[0].shift_id, 'later');
});

test('cards change at exact shift boundaries without stale past shifts becoming next', () => {
  const shifts = [shift('one', '18:00', '19:00'), shift('two', '19:00', '20:00')];
  assert.equal(partitionShifts(shifts, at('17:59')).current, null);
  assert.equal(partitionShifts(shifts, at('18:00')).current.shift_id, 'one');
  assert.equal(partitionShifts(shifts, at('19:00')).current.shift_id, 'two');
  assert.equal(partitionShifts(shifts, at('20:00')).current, null);
  assert.equal(partitionShifts(shifts, at('20:00')).next, null);
});

test('completed, cancelled, dropped and missed shifts cannot be current or next', () => {
  const shifts = ['completed', 'cancelled', 'dropped', 'no_show'].map(s => shift(s, '18:00', '19:00', s));
  for (const time of ['17:00', '18:30']) {
    assert.equal(partitionShifts(shifts, at(time)).current, null);
    assert.equal(partitionShifts(shifts, at(time)).next, null);
  }
  assert.equal(partitionShifts([], at('18:30')).total, 0);
});

test('home separates completed hours, scheduled hours, and genuinely missing occurrence notes', () => {
  const earlier = { ...shift('recurring', '08:00', '10:00', 'completed'), date: '2026-09-30' };
  const current = { ...shift('current', '11:00', '12:30'), date: '2026-09-30' };
  const next = { ...shift('next', '13:30', '15:30'), date: '2026-09-30' };
  const result = homeSummary([earlier, current, next, shift('cancelled', '16:00', '20:00', 'cancelled')], [
    { shift_id: 'recurring', occurrence_date: '2026-09-29' },
  ], at('11:42'));
  assert.equal(result.completedHours, 2);
  assert.equal(result.scheduledHours, 5.5);
  assert.equal(result.pendingNotes.length, 1);
  assert.equal(result.currentIndex, 2);
  assert.equal(result.gapMinutes, 60);
  assert.equal(result.lastEnd, at('15:30'));
  assert.equal(homeSummary([earlier], [{ shift_id: 'recurring', occurrence_date: earlier.date }], at('11:42')).pendingNotes.length, 0);
});

test('Saturday includes Sunday preview without adding next week to this week totals', () => {
  const now = Date.parse('2026-10-03T18:00:00');
  const tomorrow = { ...shift('tomorrow', '09:00', '11:00'), start_time: '2026-10-04T09:00:00', end_time: '2026-10-04T11:00:00', date: '2026-10-04' };
  const range = homeDateRange(now);
  assert.equal(range.toDate, '2026-10-04');
  assert.equal(range.weekStart.getDate(), 27);
  const summary = homeSummary([tomorrow], [], now);
  assert.equal(summary.tomorrow.length, 1);
  assert.equal(summary.scheduledHours, 0);
  assert.equal(summary.next, null);
});

test('overnight current visits survive midnight and weekly hours clip at the boundary', () => {
  const overnight = { ...shift('overnight', '23:00', '01:00'), start_time: '2026-10-03T23:00:00', end_time: '2026-10-04T01:00:00', date: '2026-10-03' };
  const summary = homeSummary([overnight], [], Date.parse('2026-10-04T00:30:00'));
  assert.equal(summary.current.shift_id, 'overnight');
  assert.equal(summary.scheduledHours, 1);
  assert.equal(summary.completedHours, 0);
});

test('empty days and unavailable attendance never become fabricated worked hours', () => {
  const result = homeSummary([], [], at('11:42'));
  assert.equal(result.total, 0);
  assert.equal(result.lastEnd, null);
  assert.equal(result.completedHours, 0);
  assert.equal(result.gapMinutes, null);
  for (const status of ['scheduled', 'in_progress', 'cancelled', 'no_show', 'dropped']) {
    assert.equal(homeSummary([shift(status, '08:00', '10:00', status)], [], at('11:42')).pendingNotes.length, 0);
  }
});
