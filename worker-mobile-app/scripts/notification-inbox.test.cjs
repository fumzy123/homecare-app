const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const ts = require('typescript');
const { QueryClient, MutationObserver } = require('@tanstack/react-query');
function load(file, imports = {}) {
  const output = ts.transpileModule(readFileSync(require.resolve(file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const mod = { exports: {} };
  new Function('require', 'exports', 'module', output)(name => imports[name] ?? require(name), mod.exports, mod);
  return mod.exports;
}
const { notificationDestination } = load('../src/features/notifications/lib/notificationDestination.ts');
const { groupNotifications, notificationPresentation, notificationTime } = load('../src/features/notifications/lib/inboxView.ts', {
  './notificationDestination': { notificationDestination },
});
const id = '879017f7-e1d9-4c89-82d6-276af8fd791c';
const notice = (id, read_at = null) => ({ id, read_at, type: 'shift_assigned', payload: {} });
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const tick = () => new Promise(resolve => setImmediate(resolve));
function setup() {
  const requests = [];
  let active = true;
  const { notificationReadOptions, notificationKey } = load('../src/features/notifications/lib/notificationRead.ts', {
    '../api': { markNotificationRead: id => { const req = { id, ...deferred() }; requests.push(req); return req.promise; } },
  });
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false, gcTime: 0 }, queries: { gcTime: Infinity } } });
  qc.setQueryData(notificationKey, { notifications: [notice('a'), notice('b')], unread_count: 2, action_needed_count: 0 });
  return { qc, requests, read: () => qc.getQueryData(notificationKey),
    mutate: id => new MutationObserver(qc, notificationReadOptions(qc, () => active)).mutate(id),
    switchAccount: () => { active = false; qc.clear(); } };
}
test('one tap updates badge and row before response, and remains read after success', async () => {
  const s = setup(); const pending = s.mutate('a'); await tick();
  assert.equal(s.requests.length, 1); assert.equal(s.read().unread_count, 1);
  assert.ok(s.read().notifications[0].read_at);
  s.requests[0].resolve(); await pending;
  assert.equal(s.read().unread_count, 1); s.qc.clear();
});
test('failure restores only the failed row, preserving another successful read; retry succeeds', async () => {
  const s = setup(); const a = s.mutate('a'); const failed = assert.rejects(a, /offline/);
  const b = s.mutate('b'); await tick();
  s.requests.find(r => r.id === 'b').resolve(); await b;
  s.requests.find(r => r.id === 'a').reject(new Error('offline')); await failed;
  assert.equal(s.read().unread_count, 1);
  assert.equal(s.read().notifications[0].read_at, null);
  assert.ok(s.read().notifications[1].read_at);
  const retry = s.mutate('a'); await tick(); s.requests[2].resolve(); await retry;
  assert.equal(s.read().unread_count, 0); s.qc.clear();
});
test('opening an already-read item cannot decrement the count twice', async () => {
  const s = setup(); const a = s.mutate('a'); await tick(); s.requests[0].resolve(); await a;
  const again = s.mutate('a'); await tick(); s.requests[1].resolve(); await again;
  assert.equal(s.read().unread_count, 1); s.qc.clear();
});
test('late response after account change cannot restore the previous account cache', async () => {
  const s = setup(); const a = s.mutate('a'); await tick(); s.switchAccount();
  s.requests[0].resolve(); await a; assert.equal(s.read(), undefined); s.qc.clear();
});
test('visit events use a stack detail destination and preserve original occurrence date', () => {
  for (const type of ['shift_assigned', 'shift_updated', 'shift_cancelled']) {
    assert.deepEqual(notificationDestination({ type, payload: { shift_id: id, occurrence_date: '2026-10-16' } }), {
      pathname: '/shifts/[shiftId]', params: { shiftId: id, occurrenceDate: '2026-10-16', source: 'notifications' },
    });
  }
});
test('missing and malformed targets use stacked schedule, never the schedule tab', () => {
  for (const payload of [{}, { shift_id: id }, { shift_id: id, occurrence_date: '2026-02-30' }, { shift_id: '../x', occurrence_date: '2026-10-16' }]) {
    assert.equal(notificationDestination({ type: 'shift_assigned', payload }).pathname, '/notifications/schedule');
  }
  assert.equal(notificationDestination({ type: 'placement_filled', payload: {} }).pathname, '/notifications/schedule');
  assert.equal(notificationDestination({ type: 'placement_created', payload: { placement_id: id } }).pathname, '/placements/[id]');
  assert.equal(notificationDestination({ type: 'placement_created', payload: {} }), null);
});

test('grouping uses calendar days across month boundaries, filters read rows and sorts newest first', () => {
  const now = new Date(2026, 10, 1, 0, 5);
  const rows = [
    { ...notice('earlier'), created_at: new Date(2026, 9, 29, 9).toISOString() },
    { ...notice('yesterday'), created_at: new Date(2026, 9, 31, 23, 59).toISOString() },
    { ...notice('read', 'saved'), created_at: new Date(2026, 10, 1, 0, 3).toISOString() },
    { ...notice('today'), created_at: new Date(2026, 10, 1, 0, 1).toISOString() },
  ];
  const before = structuredClone(rows);
  const all = groupNotifications(rows, 'all', now);
  assert.deepEqual(all.map(g => g.title), ['Today', 'Yesterday', 'Earlier']);
  assert.deepEqual(all[0].items.map(n => n.id), ['read', 'today']);
  assert.deepEqual(groupNotifications(rows, 'unread', now)[0].items.map(n => n.id), ['today']);
  assert.deepEqual(rows, before);
  assert.match(notificationTime(rows[1].created_at, now), /^Yesterday/);
});
test('visit cards only show real authorized detail, retaining context when detail is unavailable', () => {
  const n = { ...notice('a'), payload: { shift_id: id, occurrence_date: '2026-10-16', message: 'Old generic push copy' } };
  const fallback = notificationPresentation(n);
  assert.equal(fallback.title, 'New visit assigned'); assert.equal(fallback.detail, undefined);
  assert.equal(fallback.action, 'View visit'); assert.doesNotMatch(fallback.context, /generic push/);
  const loaded = notificationPresentation(n, { start_time: '2026-10-16T10:00:00', end_time: '2026-10-16T11:00:00', service_type: 'personal_care' });
  assert.match(loaded.detail, /Care visit/);
});
test('care request types have distinct titles/actions and retain approval descriptions', () => {
  for (const type of ['placement_created', 'placement_closed', 'placement_coverage_updated']) {
    const card = notificationPresentation({ type, payload: { placement_id: id } });
    assert.equal(card.action, 'View care request'); assert.notEqual(card.title, 'Agency update');
  }
  const approved = notificationPresentation({ type: 'placement_filled', payload: { message: 'Approved from October 20: Mon 09:00–12:00' } });
  assert.equal(approved.action, 'View schedule'); assert.match(approved.context, /Mon 09:00/);
  assert.equal(notificationPresentation({ type: 'unknown', payload: {} }).hasDestination, false);
});
