const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const ts = require('typescript');
const code = ts.transpileModule(readFileSync(require.resolve('../src/features/profile/lib/profileView.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const loaded = { exports: {} };
new Function('exports', 'module', code)(loaded.exports, loaded);
const { WEEK_DAYS, dayEntries, availabilityError, documentState, formatTime } = loaded.exports;
const slot = (day_of_week, start_time, end_time) => ({ day_of_week, start_time, end_time });

test('Sunday starts the week; independent and split-day availability survives grouping', () => {
  assert.deepEqual(WEEK_DAYS.map(day => day.key), ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']);
  const entries = [slot('MO', '15:00:00', '23:00:00'), slot('SU', '14:00:00', '17:00:00'), slot('SU', '08:00:00', '12:00:00')];
  const original = structuredClone(entries);
  assert.deepEqual(dayEntries(entries, 'SU').map(entry => entry.start_time), ['08:00:00', '14:00:00']);
  assert.deepEqual(dayEntries(entries, 'MO'), [entries[0]]);
  assert.deepEqual(dayEntries(entries, 'TU'), []);
  assert.deepEqual(entries, original);
  assert.equal(availabilityError(entries), undefined);
});

test('overlap, overnight, zero-length and malformed times cannot be saved', () => {
  for (const windows of [
    [slot('SU', '08:00', '17:00'), slot('SU', '16:00', '18:00')],
    [slot('MO', '23:00', '08:00')], [slot('TU', '08:00', '08:00:00')],
    [slot('WE', '24:00', '25:00')], [slot('TH', '', '17:00')],
  ]) assert.ok(availabilityError(windows));
  assert.equal(availabilityError([slot('SU', '08:00', '12:00'), slot('SU', '12:00:00', '17:00')]), undefined);
  assert.equal(availabilityError([]), undefined);
});

test('display keeps noon, midnight and afternoon unambiguous', () => {
  assert.equal(formatTime('00:00:00'), '12:00 AM');
  assert.equal(formatTime('12:00:00'), '12:00 PM');
  assert.equal(formatTime('23:15:00'), '11:15 PM');
});

test('document state uses agency verification and local calendar dates', () => {
  const today = new Date(2026, 9, 2, 22, 30);
  const credential = { file_url: 'document.pdf', verified_at: '2026-09-01T10:00:00Z', expiry_date: '2026-10-02' };
  assert.equal(documentState(undefined, today), 'missing');
  assert.equal(documentState({ ...credential, file_url: null }, today), 'missing');
  assert.equal(documentState({ ...credential, verified_at: null, expiry_date: null }, today), 'pending');
  assert.equal(documentState(credential, today), 'expiring');
  assert.equal(documentState({ ...credential, expiry_date: '2026-10-01' }, today), 'expired');
  assert.equal(documentState({ ...credential, expiry_date: '2026-11-01' }, today), 'expiring');
  assert.equal(documentState({ ...credential, expiry_date: '2026-11-02' }, today), 'current');
});
