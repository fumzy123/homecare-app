const test = require('node:test');
const assert = require('node:assert/strict');
const { createEnvironment } = require('./environment.cjs');
const { execFileSync } = require('node:child_process');
const { resolve } = require('node:path');
const profiles = require('../eas.json').build;

function appConfig(appEnv) {
  const env = { ...process.env };
  delete env.APP_ENV;
  delete env.GOOGLE_SERVICES_JSON;
  if (appEnv !== undefined) env.APP_ENV = appEnv;
  return JSON.parse(execFileSync(process.execPath,
    ['-e', 'console.log(JSON.stringify(require("./app.config.js").expo))'],
    { cwd: resolve(__dirname, '..'), env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
}

const settings = `
EXPO_PUBLIC_BACKEND_API_URL="https://staging.example.com"
EXPO_PUBLIC_SUPABASE_URL="https://example.supabase.co"
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY="sb_publishable_test" # public fixture
APP_ENV=production
`;

test('selected file replaces inherited connections and optional public settings', () => {
  const result = createEnvironment('staging', settings, {
    PATH: 'keep-path', APP_ENV: 'production', NODE_ENV: 'production',
    EXPO_PUBLIC_BACKEND_API_URL: 'https://production.example.com',
    EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'old-key',
    EXPO_PUBLIC_FRONTEND_URL: 'https://old.example.com', EXPO_NO_CLIENT_ENV_VARS: '1',
  });
  assert.equal(result.APP_ENV, 'staging');
  assert.equal(result.EXPO_PUBLIC_BACKEND_API_URL, 'https://staging.example.com');
  assert.equal(result.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY, 'sb_publishable_test');
  assert.equal(result.EXPO_PUBLIC_FRONTEND_URL, undefined);
  assert.equal(result.EXPO_NO_CLIENT_ENV_VARS, undefined);
  assert.equal(result.EXPO_NO_DOTENV, '1');
  assert.equal(result.NODE_ENV, 'development');
  assert.equal(result.PATH, 'keep-path');
});

test('missing key cannot silently fall back to a key from the shell', () => {
  assert.throws(() => createEnvironment('staging', settings.replace(/^EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=.*$/m, ''), {
    EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'inherited-key',
  }), /missing EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
});

test('rejects unknown environment names including prototype properties', () => {
  for (const name of ['stagng', 'toString', '__proto__']) {
    assert.throws(() => createEnvironment(name, settings), /Choose local/);
  }
});

test('allows local HTTP but requires HTTPS for hosted environments', () => {
  const local = settings.replace('https://staging.example.com', 'http://127.0.0.1:8000');
  assert.equal(createEnvironment('local', local).APP_ENV, 'local');
  assert.throws(() => createEnvironment('staging', local), /must use HTTPS/);
  assert.equal(createEnvironment('production', settings).APP_ENV, 'production');
});

test('rejects credential-bearing URLs without revealing their contents', () => {
  const unsafe = settings.replace('https://staging.example.com', 'https://user:private-password@example.com');
  assert.throws(() => createEnvironment('staging', unsafe), error => {
    assert.equal(error.message.includes('private-password'), false);
    return /without credentials/.test(error.message);
  });
});

test('rejects secret keys and service-role JWTs', () => {
  const jwt = `e30.${Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url')}.signature`;
  for (const key of ['sb_secret_do_not_print', jwt]) {
    assert.throws(() => createEnvironment('staging', settings.replace('sb_publishable_test', key)), error => {
      assert.equal(error.message.includes(key), false);
      return true;
    });
  }
});

test('local naming preserves installed identities and tooling mode across environments', () => {
  for (const [name, label, packageId] of [
    ['local', 'Care Harbor (Dev)', 'com.homecareapp.worker.dev'],
    ['staging', 'Care Harbor (Staging)', 'com.homecareapp.worker.staging'],
    ['production', 'Care Harbor', 'com.homecareapp.worker'],
  ]) {
    const env = createEnvironment(name, settings);
    const config = appConfig(env.APP_ENV);
    assert.equal(env.APP_ENV, name);
    assert.equal(env.NODE_ENV, 'development');
    assert.equal(config.name, label);
    assert.equal(config.android.package, packageId);
    assert.equal(config.ios.bundleIdentifier, packageId);
  }
  assert.equal(appConfig().android.package, 'com.homecareapp.worker.dev');
});

test('obsolete or misspelled APP_ENV cannot silently select production identity', () => {
  for (const name of ['development', 'stagng', '']) {
    assert.throws(() => appConfig(name), /APP_ENV must be local, staging or production/);
  }
});

test('EAS profiles preserve settings groups and identities after the local rename', () => {
  function resolved(name) {
    const profile = profiles[name];
    const parent = profile.extends ? resolved(profile.extends) : {};
    return { ...parent, ...profile, env: { ...parent.env, ...profile.env } };
  }
  for (const [name, appEnv, group, devClient] of [
    ['development', 'local', 'development', true],
    ['development-staging', 'staging', 'preview', true],
    ['preview', 'staging', 'preview', false],
    ['production', 'production', 'production', false],
  ]) {
    const profile = resolved(name);
    assert.equal(profile.env.APP_ENV, appEnv);
    assert.equal(profile.environment, group);
    assert.equal(Boolean(profile.developmentClient), devClient);
    assert.equal(profile.env.EXPO_NO_DOTENV, '1');
    assert.equal(appConfig(profile.env.APP_ENV).android.package, appConfig(appEnv).android.package);
  }
});
