const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const ts = require('typescript');
const React = require('react');
const { act, create } = require('react-test-renderer');
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function load(path, imports) {
  const code = ts.transpileModule(readFileSync(require.resolve(path), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const mod = { exports: {} };
  new Function('require', 'exports', 'module', code)(name => imports[name] ?? require(name), mod.exports, mod);
  return mod.exports;
}

test('sign out waits for push revocation before ending this device session', async () => {
  const calls = [];
  let finishRevoke;
  const { signOut } = load('../src/features/auth/api.ts', {
    '@/features/notifications/lib/pushRegistration': {
      unregisterPush: () => { calls.push('revoke'); return new Promise(resolve => { finishRevoke = resolve; }); },
    },
    '@/shared/lib/api-client': { supabase: { auth: {
      signOut: async options => { calls.push(options); return { error: null }; },
    } } },
  });
  const logout = signOut();
  assert.deepEqual(calls, ['revoke']);
  finishRevoke(); await logout;
  assert.deepEqual(calls, ['revoke', { scope: 'local' }]);
});

for (const failure of ['revocation', 'auth']) test(`${failure} failure remains signed in and permits an explicit retry`, async () => {
  const calls = [];
  const error = new Error('Network unavailable');
  let fail = true;
  const { signOut } = load('../src/features/auth/api.ts', {
    '@/features/notifications/lib/pushRegistration': {
      unregisterPush: async () => { calls.push('revoke'); if (fail && failure === 'revocation') throw error; },
      setPushUser: userId => calls.push(['restore', userId]),
    },
    '@/shared/lib/api-client': { supabase: { auth: {
      signOut: async () => { calls.push('auth'); return { error: fail && failure === 'auth' ? error : null }; },
      getSession: async () => ({ data: { session: { user: { id: 'worker' } } } }),
    } } },
  });
  await assert.rejects(signOut(), error);
  assert.deepEqual(calls.at(-1), ['restore', 'worker']);
  if (failure === 'revocation') assert.equal(calls.includes('auth'), false);
  fail = false; await signOut();
  assert.deepEqual(calls.slice(-2), ['revoke', 'auth']);
});

test('Me asks for confirmation; cancel does nothing; confirming invokes logout once', async () => {
  const alerts = []; let attempts = 0;
  const native = Object.fromEntries(['ActivityIndicator', 'Pressable', 'RefreshControl', 'ScrollView', 'Text', 'View'].map(name => [name, name]));
  const { WorkerMe } = load('../src/features/profile/components/WorkerMe.tsx', {
    'expo-router': { router: {} },
    'react-native': { ...native, Alert: { alert: (...args) => alerts.push(args) } },
    '@expo/vector-icons': { Ionicons: 'Ionicons' },
    '@/shared/components/Dialog': { Dialog: 'Dialog' },
    '@/shared/components/ui/Btn': { Btn: 'Btn' },
    '@/shared/hooks/useRefreshControl': { useRefreshControl: () => ({}) },
    '@/features/auth/hooks/useAuth': { useSignOut: () => ({ isPending: false, mutate: () => attempts++ }) },
    '../hooks/useWorkerProfile': { useWorkerProfile: () => ({ data: { availability: [] } }) },
    '../hooks/useMyCredentials': { useMyCredentials: () => ({ data: [] }) },
    '../types': { DOCUMENT_TYPE_LABELS: {} },
    '../lib/profileView': { WEEK_DAYS: Array.from({ length: 7 }, () => ({ key: 'MO' })), humanize: () => '', documentSummary: () => '' },
    './ProfileOverview': { ProfileIdentity: 'ProfileIdentity', ProfileRow: 'ProfileRow', ReadOnlyDetail: 'ReadOnlyDetail', WorkingWeek: 'WorkingWeek' },
    './ProfileDetailsDialog': { ProfileDetailsDialog: 'ProfileDetailsDialog' },
    './AvailabilityDialog': { AvailabilityDialog: 'AvailabilityDialog' },
    './DocumentsDialog': { DocumentsDialog: 'DocumentsDialog' },
  });
  let tree;
  await act(async () => { tree = create(React.createElement(WorkerMe)); });
  const button = tree.root.findAllByType('Pressable').find(node => node.findAllByType('Text').some(text => text.props.children === 'Sign out'));
  await act(async () => button.props.onPress());
  assert.equal(attempts, 0);
  assert.equal(alerts[0][0], 'Sign out?');
  const buttons = alerts[0][2];
  assert.equal(buttons[0].style, 'cancel');
  await act(async () => buttons[0].onPress?.());
  assert.equal(attempts, 0);
  await act(async () => buttons[1].onPress());
  assert.equal(attempts, 1);
  await act(async () => tree.unmount());
});
