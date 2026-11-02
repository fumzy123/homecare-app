const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const ts = require('typescript');
const React = require('react');
const { act, create } = require('react-test-renderer');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const native = Object.fromEntries(['View', 'Text', 'Pressable', 'ScrollView', 'TextInput', 'ActivityIndicator', 'RefreshControl'].map(name => [name, name]));
function load(file, imports = {}) {
  const code = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const mod = { exports: {} };
  new Function('require', 'exports', 'module', code)(name => ({
    'react-native': native,
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    '@expo/vector-icons': { Ionicons: 'Ionicons' },
    ...imports,
  })[name] ?? require(name), mod.exports, mod);
  return mod.exports;
}
const { resolve } = require('node:path');
const file = path => resolve(__dirname, '..', path);
const { notificationDestination } = load(file('src/features/notifications/lib/notificationDestination.ts'));
const inboxView = load(file('src/features/notifications/lib/inboxView.ts'), { './notificationDestination': { notificationDestination } });
const placementId = '879017f7-e1d9-4c89-82d6-276af8fd791c';
const slot = (id, covered) => ({ id, day_of_week: 'WE', start_time: '09:00:00', end_time: '11:00:00', worker_id: covered ? 'worker' : null, worker_name: covered ? 'Test Worker' : null });
const placement = (status, slots) => ({ id: placementId, status, care_slots: slots, interested_care_slot_ids: [], client_first_name: 'Test', client_last_name: 'Client', masked_location: 'Test city', scheduled_from: '2026-11-02', start_date: '2026-11-02', requirements: null, has_interest: false, interest_note: null });
async function render(Component, props = {}) {
  let tree;
  await act(async () => { tree = create(React.createElement(Component, props)); });
  return tree;
}

test('Expo stack GO_BACK restores the same inbox after either notification destination', () => {
  // Exercise the router shipped with SDK 57; Android hardware Back dispatches GO_BACK.
  const { StackRouter, StackActions } = require('expo-router/build/react-navigation/routers/StackRouter');
  const layout = readFileSync(file('app/_layout.tsx'), 'utf8');
  const routeNames = [...layout.matchAll(/<Stack.Screen name="([^"]+)"/g)].map(match => match[1]);
  const options = { routeNames, routeParamList: {}, routeGetIdList: {} };
  const stack = StackRouter({ initialRouteName: '(tabs)' });
  let state = stack.getInitialState(options);
  state = stack.getStateForAction(state, StackActions.push('notifications/index'), options);
  const inboxKey = state.routes[state.index].key;
  for (const type of ['placement_filled', 'placement_coverage_updated']) {
    const destination = notificationDestination({ type, payload: { placement_id: placementId } });
    const opened = stack.getStateForAction(state, StackActions.push(destination.pathname.slice(1), destination.params), options);
    assert.equal(opened.routes[opened.index].name, destination.pathname.slice(1));
    const back = stack.getStateForAction(opened, { type: 'GO_BACK' }, options);
    assert.equal(back.routes[back.index].key, inboxKey);
  }
});

for (const [name, status, slots, available] of [
  ['fully covered', 'filled', [slot('covered', true)], 0],
  ['partly covered', 'open', [slot('covered', true), slot('open', false)], 1],
  ['closed', 'closed', [slot('closed', false)], 0],
  ['legacy without slot identities', 'open', [slot(null, false)], 0],
]) test(`${name} care request renders without retired service_type and only offers eligible slots`, async () => {
  const data = placement(status, slots);
  const { PlacementDetail } = load(process.env.PLACEMENT_COMPONENT_SOURCE || file('src/features/placements/components/PlacementDetail.tsx'), {
    '../hooks/usePlacement': {
      usePlacement: () => ({ data, isPending: false, isError: false }),
      useExpressInterest: () => ({ isPending: false }), useWithdrawInterest: () => ({ isPending: false }),
    },
  });
  const tree = await render(PlacementDetail, { placementId });
  const cards = tree.root.findAllByProps({ accessibilityRole: 'checkbox' });
  assert.equal(cards.length, slots.length);
  assert.equal(cards.filter(card => !card.props.disabled).length, available);
  const output = JSON.stringify(tree.toJSON());
  assert.match(output, /Wednesday/);
  assert.match(output, /09:00/);
  assert.match(output, /Care visit/);
  if (status === 'filled') assert.match(output, /Fully covered/);
  await act(async () => tree.unmount());
});

test('placement loading, arrival and lost access remain recoverable', async () => {
  let retries = 0;
  let query = { isPending: true, refetch: () => { retries++; } };
  const { PlacementDetail } = load(file('src/features/placements/components/PlacementDetail.tsx'), {
    '../hooks/usePlacement': { usePlacement: () => query, useExpressInterest: () => ({}), useWithdrawInterest: () => ({}) },
  });
  const tree = await render(PlacementDetail, { placementId });
  assert.equal(tree.root.findAllByType('ActivityIndicator').length, 1);
  query = { ...query, isPending: false, data: placement('filled', [slot('covered', true)]) };
  await act(async () => tree.update(React.createElement(PlacementDetail, { placementId })));
  assert.match(JSON.stringify(tree.toJSON()), /Fully covered/);
  query = { ...query, isError: true, data: undefined };
  await act(async () => tree.update(React.createElement(PlacementDetail, { placementId })));
  assert.match(JSON.stringify(tree.toJSON()), /Could not load placement/);
  await act(async () => tree.root.findByType('Pressable').props.onPress());
  assert.equal(retries, 1);
  await act(async () => tree.unmount());
});

for (const [type, expected] of [['placement_filled', '/notifications/schedule'], ['placement_coverage_updated', '/placements/[id]']]) {
  test(`${type} inbox tap marks read and pushes a detail route`, async () => {
    const events = [];
    const notification = { id: 'notice', type, payload: { placement_id: placementId }, read_at: null, created_at: new Date().toISOString() };
    const { NotificationsInbox } = load(file('src/features/notifications/components/NotificationsInbox.tsx'), {
      'expo-router': { router: { push: destination => events.push(['push', destination]) } },
      '../hooks/useMyNotifications': { useMyNotifications: () => ({ data: { notifications: [notification], unread_count: 1 } }), useMarkNotificationRead: () => ({ mutateAsync: async id => events.push(['read', id]), isPending: false }) },
      '../hooks/useNotificationVisits': { useNotificationVisits: () => new Map() },
      '@/shared/hooks/useRefreshControl': { useRefreshControl: () => ({}) },
      '../lib/notificationDestination': { notificationDestination },
      '../lib/inboxView': inboxView,
      './NotificationCard': { NotificationCard: 'NotificationCard' },
      '@/shared/lib/auth-store': { useAuthStore: { getState: () => ({ user: { id: 'worker' } }) } },
    });
    const tree = await render(NotificationsInbox);
    await act(async () => { tree.root.findByType('NotificationCard').props.onPress(); });
    assert.deepEqual(events[0], ['read', 'notice']);
    assert.equal(events[1][0], 'push');
    assert.equal(events[1][1].pathname, expected);
    if (type === 'placement_coverage_updated') assert.equal(events[1][1].params.source, 'notifications');
    await act(async () => tree.unmount());
  });
}

for (const route of ['app/notifications/schedule.tsx', 'app/placements/[id].tsx']) {
  for (const hasHistory of [true, false]) test(`${route} returns to inbox ${hasHistory ? 'through history' : 'without history'}`, async () => {
    const calls = [];
    const { default: Screen } = load(file(route), {
      'expo-router': { router: { canGoBack: () => hasHistory, back: () => calls.push('back'), replace: path => calls.push(path) }, useLocalSearchParams: () => ({ id: placementId, source: 'notifications' }) },
      '@/features/shifts/components/ScheduleView': { ScheduleView: 'ScheduleView' },
      '@/features/placements/components/PlacementDetail': { PlacementDetail: 'PlacementDetail' },
    });
    const tree = await render(Screen);
    await act(async () => tree.root.findByProps({ accessibilityLabel: 'Back to notifications' }).props.onPress());
    assert.deepEqual(calls, [hasHistory ? 'back' : '/notifications']);
    await act(async () => tree.unmount());
  });
}
