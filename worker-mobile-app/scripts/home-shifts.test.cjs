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
