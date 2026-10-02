const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const ts = require('typescript');

function setup({ go = false, granted = true, put } = {}) {
  let saved = null;
  const calls = [];
  const notifications = {
    AndroidImportance: { HIGH: 4 },
    setNotificationChannelAsync: async () => {},
    getPermissionsAsync: async () => ({ granted, canAskAgain: true }),
    getExpoPushTokenAsync: async () => ({ data: 'ExpoPushToken[test]' }),
  };
  const mocks = {
    'expo-constants': { default: { executionEnvironment: go ? 'store' : 'standalone', expoConfig: { extra: { eas: { projectId: 'project' } }, android: { package: 'com.homecareapp.worker.staging' } } }, ExecutionEnvironment: { StoreClient: 'store' } },
    'react-native': { Platform: { OS: 'android' } },
    'expo-secure-store': { getItemAsync: async () => saved, setItemAsync: async (_, v) => { saved = v; } },
    'expo-crypto': { randomUUID: () => 'device', getRandomBytes: () => new Uint8Array(32) },
    'expo-notifications': notifications,
    '@/shared/lib/api-client': { apiClient: {
      put: async (...args) => { calls.push(['register', ...args]); if (put) await put(); },
      post: async (...args) => { calls.push(['revoke', ...args]); },
    }, supabase: { auth: { getSession: async () => ({ data: { session: { user: { id: 'worker' } } } }) } } },
  };
  const code = ts.transpileModule(readFileSync(require.resolve('../src/features/notifications/lib/pushRegistration.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  mocks['expo-constants'].__esModule = true;
  mocks['../api'] = {
    savePushDevice: (...args) => mocks['@/shared/lib/api-client'].apiClient.put(...args),
    revokePushDevice: (...args) => mocks['@/shared/lib/api-client'].apiClient.post(...args),
  };
  const module = { exports: {} };
  new Function('require', 'exports', 'module', code)(name => {
    if (go && name === 'expo-notifications') throw Error('Native import in Expo Go');
    return mocks[name];
  }, module.exports, module);
  return { ...module.exports, calls, saved: () => JSON.parse(saved) };
}

test('Expo Go never imports native push', async () => {
  const app = setup({ go: true });
  assert.equal(await app.registerPush('worker'), 'unsupported');
  assert.equal(app.calls.length, 0);
});
test('denied permission does not register or prompt automatically', async () => {
  const app = setup({ granted: false }); app.setPushUser('worker');
  assert.equal(await app.registerPush('worker'), 'off');
  assert.equal(app.calls.length, 0);
});
test('registration stores cleanup proof and logout revokes it', async () => {
  const app = setup(); app.setPushUser('worker');
  assert.equal(await app.registerPush('worker'), 'registered');
  assert.equal(app.saved().owner, 'worker');
  await app.unregisterPush();
  assert.deepEqual(app.calls.map(c => c[0]), ['register', 'revoke']);
  assert.equal(app.saved().owner, undefined);
});
test('logout during an in-flight registration cannot leave delivery enabled', async () => {
  let finish; let started;
  const waiting = new Promise(resolve => { started = resolve; });
  const app = setup({ put: () => { started(); return new Promise(resolve => { finish = resolve; }); } });
  app.setPushUser('worker');
  const registering = app.registerPush('worker');
  await waiting;
  const logout = app.unregisterPush(); finish();
  assert.equal(await registering, 'off'); await logout;
  assert.equal(app.saved().owner, undefined);
  assert.deepEqual(app.calls.map(c => c[0]), ['register', 'revoke']);
});

test('timed-out registration retains cleanup proof for a later logout', async () => {
  const app = setup({ put: async () => { throw new Error('Network timeout'); } });
  app.setPushUser('worker');
  await assert.rejects(app.registerPush('worker'));
  assert.equal(app.saved().owner, 'worker');
  await app.unregisterPush();
  assert.equal(app.saved().owner, undefined);
  assert.deepEqual(app.calls.map(c => c[0]), ['register', 'revoke']);
});

test('an old user cannot register after the active account changes', async () => {
  const app = setup(); app.setPushUser('someone-else');
  assert.equal(await app.registerPush('worker'), 'off');
  assert.equal(app.calls.length, 0);
});
