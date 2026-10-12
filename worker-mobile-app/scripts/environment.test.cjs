const test = require('node:test');
const assert = require('node:assert/strict');
const { createEnvironment } = require('./environment.cjs');

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
  assert.equal(createEnvironment('local', local).APP_ENV, 'development');
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
