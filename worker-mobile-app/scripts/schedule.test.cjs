const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

// Exercise the pure production projection without a React Native runtime.
const modules = new Map();
function loadTs(filename) {
  if (modules.has(filename)) return modules.get(filename).exports;
  const module = { exports: {} };
  modules.set(filename, module);
  const code = ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  new Function('require', 'exports', 'module', code)(name => loadTs(path.resolve(path.dirname(filename), `${name}.ts`)), module.exports, module);
  return module.exports;
}
const { startOfSundayWeek, getPeriodDays, toDateKey, scheduledHours, shiftsForDate } = loadTs(require.resolve('../src/features/shifts/lib/schedule.ts'));
const { buildScheduleDays, selectScheduleDate, changeSchedulePeriod, moveSchedulePeriod, calendarMonthCells, shiftAddress } = loadTs(require.resolve('../src/features/shifts/lib/scheduleView.ts'));
const date = key => new Date(`${key}T00:00:00`);
const start = date('2026-09-27');
const now = Date.parse('2026-09-30T10:15:00');
const shift = (id, day, from, to, status = 'scheduled') => ({
  shift_id: id, date: day, start_time: `${day}T${from}:00`, end_time: `${day}T${to}:00`, completion_status: status,
  client: { id: 'client', first_name: 'Test', last_name: 'Client', street: '18 Cedar Road', city: 'St. John’s' }, location: null,
});
const selection = { period: 'two_weeks', start, selectedDate: '2026-09-30', layout: 'day' };
const day = shifts => buildScheduleDays(start, 'week', shifts, [], now).find(d => d.key === '2026-09-30');

test('week is Sunday to Saturday across month and year boundaries', () => {
  for (const key of ['2026-09-27', '2026-09-30', '2026-10-03']) assert.equal(toDateKey(startOfSundayWeek(date(key))), '2026-09-27');
  const days = getPeriodDays(startOfSundayWeek(date('2027-01-01')), 'two_weeks');
  assert.equal(toDateKey(days[0]), '2026-12-27');
  assert.equal(toDateKey(days.at(-1)), '2027-01-09');
  assert.equal(days[0].getDay(), 0);
  assert.equal(days.at(-1).getDay(), 6);
});

test('selecting the second week preserves the two-week range and switching to week contains the selection', () => {
  const selected = selectScheduleDate(selection, date('2026-10-08'));
  assert.equal(toDateKey(selected.start), '2026-09-27');
  assert.equal(selected.selectedDate, '2026-10-08');
  const weekly = changeSchedulePeriod(selected, 'week');
  assert.equal(toDateKey(weekly.start), '2026-10-04');
  const next = moveSchedulePeriod(selected, 1);
  assert.equal(toDateKey(next.start), '2026-10-11');
  assert.equal(next.selectedDate, '2026-10-22');
  assert.deepEqual(moveSchedulePeriod(next, -1), selected);
  assert.equal(toDateKey(selection.start), '2026-09-27');
});

test('selecting outside the current range starts at that date’s Sunday', () => {
  const next = selectScheduleDate(selection, date('2027-01-01'));
  assert.equal(toDateKey(next.start), '2026-12-27');
  assert.equal(next.selectedDate, '2027-01-01');
});

test('month picker uses Sunday columns, leap days, and padded complete rows', () => {
  const september = calendarMonthCells(date('2026-09-01'));
  assert.deepEqual(september[0].slice(0, 2), [null, null]);
  assert.equal(toDateKey(september[0][2]), '2026-09-01');
  assert.equal(calendarMonthCells(date('2028-02-01')).flat().filter(Boolean).length, 29);
  const sixRows = calendarMonthCells(date('2026-05-01'));
  assert.equal(sixRows.length, 6);
  assert.ok(sixRows.every(row => row.length === 7));
});

test('hours and visit counts exclude cancelled, dropped, and missed visits while retaining their visible records', () => {
  const shifts = ['scheduled', 'in_progress', 'completed', 'cancelled', 'dropped', 'no_show'].map((s, i) => shift(s, '2026-09-30', `${8 + i}:00`, `${9 + i}:00`, s));
  // ISO timestamps require two-digit hours.
  shifts.forEach(s => { s.start_time = s.start_time.replace(/T(\d):/, 'T0$1:'); s.end_time = s.end_time.replace(/T(\d):/, 'T0$1:'); });
  const result = day(shifts);
  assert.equal(result.hours, 3);
  assert.equal(result.visitCount, 3);
  assert.equal(result.visits.length, 6);
  assert.equal(result.finish, '2026-09-30T11:00:00');
});

test('sorts visits without mutation, calculates real gaps, and identifies only the nearest future visit today', () => {
  const shifts = [shift('last', '2026-09-30', '13:30', '15:30'), shift('first', '2026-09-30', '08:00', '10:00', 'completed'), shift('next', '2026-09-30', '11:00', '12:30')];
  const result = day(shifts);
  assert.deepEqual(result.visits.map(v => v.shift.shift_id), ['first', 'next', 'last']);
  assert.deepEqual(result.visits.map(v => v.gapMinutes), [null, 60, 60]);
  assert.deepEqual(result.visits.filter(v => v.isNext).map(v => v.shift.shift_id), ['next']);
  assert.equal(result.hours, 5.5);
  assert.equal(shifts[0].shift_id, 'last');
  const tomorrow = buildScheduleDays(start, 'week', [shift('tomorrow', '2026-10-01', '11:00', '12:30')], [], now).find(d => d.key === '2026-10-01');
  assert.equal(tomorrow.visits[0].isNext, false);
  const boundary = buildScheduleDays(start, 'week', shifts, [], Date.parse('2026-09-30T11:00:00')).find(d => d.key === '2026-09-30');
  assert.equal(boundary.visits[1].isScheduledNow, true);
  assert.equal(boundary.visits[1].isNext, false);
  assert.equal(boundary.visits[2].isNext, true);
});

test('gaps skip cancelled visits, handle back-to-back visits, and flag overlapping time', () => {
  const result = day([shift('first', '2026-09-30', '08:00', '12:00'), shift('cancelled', '2026-09-30', '09:00', '16:00', 'cancelled'), shift('overlap', '2026-09-30', '10:00', '11:00'), shift('next', '2026-09-30', '12:00', '13:00')]);
  assert.deepEqual(result.visits.map(v => v.gapMinutes), [null, null, -120, 0]);
  assert.equal(result.finish, '2026-09-30T13:00:00');
});

test('note indicators require a successful lookup and match a recurring shift’s occurrence date', () => {
  const shifts = [shift('recurring', '2026-09-30', '08:00', '10:00', 'completed')];
  const project = notes => buildScheduleDays(start, 'week', shifts, notes, now).find(d => d.key === '2026-09-30').visits[0];
  assert.equal(project(undefined).noteStatus, 'unknown');
  assert.equal(project([]).noteStatus, 'needed');
  assert.equal(project([{ shift_id: 'recurring', occurrence_date: '2026-09-29' }]).noteStatus, 'needed');
  assert.equal(project([{ shift_id: 'recurring', occurrence_date: '2026-09-30' }]).noteStatus, 'saved');
});

test('overnight visits retain their real duration and next-day finish; invalid durations do not corrupt totals', () => {
  const overnight = { ...shift('overnight', '2026-09-30', '22:00', '23:00'), end_time: '2026-10-01T02:00:00' };
  assert.equal(day([overnight]).hours, 4);
  assert.equal(day([overnight]).finish, overnight.end_time);
  assert.equal(scheduledHours([{ ...overnight, end_time: 'invalid' }]), 0);
  assert.equal(scheduledHours([{ ...overnight, end_time: '2026-09-30T21:00:00' }]), 0);
});

test('week totals and two-week totals come from only the displayed days', () => {
  const shifts = [shift('first-week', '2026-09-30', '08:00', '10:00'), shift('second-week', '2026-10-08', '08:00', '11:00'), shift('outside', '2026-10-11', '08:00', '12:00')];
  const hours = period => buildScheduleDays(start, period, shifts, [], now).reduce((sum, d) => sum + d.hours, 0);
  assert.equal(hours('week'), 2);
  assert.equal(hours('two_weeks'), 5);
});

test('calendar navigation preserves local dates across daylight-saving changes', () => {
  const before = { ...selection, start: date('2026-10-25'), selectedDate: '2026-10-30' };
  const next = moveSchedulePeriod(before, 1);
  assert.equal(toDateKey(next.start), '2026-11-08');
  assert.equal(next.selectedDate, '2026-11-13');
  assert.equal(next.start.getHours(), 0);
});

test('directions prefer the shift location and otherwise use the client’s full address', () => {
  const s = shift('visit', '2026-09-30', '08:00', '10:00');
  assert.equal(shiftAddress(s), '18 Cedar Road, St. John’s');
  assert.equal(shiftAddress({ ...s, location: '  New visit location  ' }), 'New visit location');
  assert.equal(shiftsForDate([s], '2026-10-01').length, 0);
});
