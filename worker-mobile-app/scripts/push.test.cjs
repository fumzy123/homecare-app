const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const ts = require('typescript');

function setup({ go = false, granted = true, put, onNativeToken } = {}) {
  let saved = null;
  const calls = [];
  const tokenOptions = [];
  const notifications = {
    AndroidImportance: { HIGH: 4 },
    setNotificationChannelAsync: async () => {},
    getPermissionsAsync: async () => ({ granted, canAskAgain: true }),
    getExpoPushTokenAsync: async options => {
      tokenOptions.push(options);
      // SDK 57 Android emits a token event whenever the native getter runs.
      if (!options.devicePushToken) onNativeToken?.({ type: 'android', data: 'native-test-token' });
      return { data: 'ExpoPushToken[test]' };
    },
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
  return { ...module.exports, calls, tokenOptions, saved: () => JSON.parse(saved) };
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

test('token event registration reuses the native token without requesting another', async () => {
  let nativeReads = 0;
  const app = setup({ onNativeToken: () => nativeReads++ });
  app.setPushUser('worker');
  const devicePushToken = { type: 'android', data: 'rotated-test-token' };
  assert.equal(await app.registerPush('worker', false, devicePushToken), 'registered');
  assert.equal(nativeReads, 0);
  assert.deepEqual(app.tokenOptions, [{ projectId: 'project', devicePushToken }]);
  assert.equal(app.calls.filter(call => call[0] === 'register').length, 1);
});

function eventsSetup(lastResponse = null, refreshToken) {
  const code = ts.transpileModule(readFileSync(require.resolve('../src/features/notifications/lib/pushEvents.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  new Function('exports', 'module', code)(module.exports, module);
  const listeners = {}; const calls = []; let handler; let current = true;
  const add = name => callback => { listeners[name] = callback; return { remove: () => calls.push('remove:' + name) }; };
  const notifications = {
    setNotificationHandler: value => { handler = value; },
    addNotificationResponseReceivedListener: add('tap'),
    addNotificationReceivedListener: add('receive'),
    addPushTokenListener: add('token'),
    getLastNotificationResponse: () => lastResponse,
    clearLastNotificationResponseAsync: async () => calls.push('clear'),
  };
  const cleanup = module.exports.installPushEvents(notifications, () => current,
    () => calls.push('inbox'), () => calls.push('refresh'), token => { calls.push('register'); refreshToken?.(token); });
  return { listeners, calls, cleanup, handler: () => handler, changeAccount: () => { current = false; } };
}
const tap = { actionIdentifier: 'default', notification: { request: { identifier: 'notice-1', content: { data: { url: 'https://untrusted.example' } } } } };

test('native token events forward their exact token and stop after account change or cleanup', () => {
  const forwarded = [];
  const app = eventsSetup(null, token => forwarded.push(token));
  const first = { type: 'android', data: 'first-native-token' };
  const rotated = { type: 'android', data: 'rotated-native-token' };
  app.listeners.token(first); app.listeners.token(rotated);
  assert.deepEqual(forwarded, [first, rotated]);
  app.changeAccount(); app.listeners.token(first);
  app.cleanup(); app.listeners.token(rotated);
  assert.equal(forwarded.length, 2);
});

test('registration and its Android token event settle without an endless registration loop', async () => {
  let nativeReads = 0;
  const followups = [];
  const failures = [];
  let events;
  const app = setup({ onNativeToken: token => {
    if (++nativeReads > 3) throw new Error('Recursive native token request');
    events.listeners.token(token);
  } });
  app.setPushUser('worker');
  events = eventsSetup(null, token => {
    followups.push(app.registerPush('worker', false, token).catch(error => { failures.push(error); }));
  });
  assert.equal(await app.registerPush('worker', true), 'registered');
  // Process any follow-ups added during registration, including a regression loop.
  for (let i = 0; i < followups.length; i++) await followups[i];
  assert.equal(nativeReads, 1);
  assert.equal(followups.length, 1);
  assert.deepEqual(failures, []);
  assert.equal(app.calls.filter(call => call[0] === 'register').length, 2);
  events.cleanup();
  await app.unregisterPush();
  assert.equal(app.saved().owner, undefined);
});

test('cold-start and background taps open the inbox once and ignore payload URLs', () => {
  const app = eventsSetup(tap);
  app.listeners.tap(tap);
  assert.deepEqual(app.calls, ['refresh', 'inbox', 'clear']);
  app.cleanup();
  assert.equal(app.handler(), null);
  assert.equal(app.calls.filter(c => c.startsWith('remove:')).length, 3);
});

test('foreground arrivals refresh data and account changes block old listeners', async () => {
  const app = eventsSetup();
  app.listeners.receive(); app.listeners.token();
  assert.deepEqual(app.calls, ['refresh', 'register']);
  assert.equal((await app.handler().handleNotification()).shouldShowBanner, true);
  app.changeAccount();
  app.listeners.receive(); app.listeners.token(); app.listeners.tap(tap);
  assert.deepEqual(app.calls, ['refresh', 'register']);
  assert.equal((await app.handler().handleNotification()).shouldShowBanner, false);
});

test('callbacks retained by native delivery cannot navigate after cleanup', () => {
  const app = eventsSetup(); app.cleanup();
  app.listeners.tap(tap); app.listeners.receive();
  assert.equal(app.calls.includes('inbox'), false);
  assert.equal(app.calls.includes('refresh'), false);
});

test('EAS file configuration overrides the ignored local staging path', () => {
  const { execFileSync } = require('node:child_process');
  function config(environment, file) {
    const env = { ...process.env, APP_ENV: environment };
    if (file) env.GOOGLE_SERVICES_JSON = file; else delete env.GOOGLE_SERVICES_JSON;
    return JSON.parse(execFileSync(process.execPath, ['-e', 'console.log(JSON.stringify(require("./app.config.js").expo.android))'], { cwd: require('node:path').resolve(__dirname, '..'), env, encoding: 'utf8' }));
  }
  assert.equal(config('staging').googleServicesFile, './google-services.staging.json');
  assert.equal(config('staging', '/build/config.json').googleServicesFile, '/build/config.json');
  assert.equal(config('production').googleServicesFile, undefined);
  assert.equal(config('production', '/build/production.json').googleServicesFile, '/build/production.json');
});
