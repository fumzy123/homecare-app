const { parseEnv } = require('node:util');

const environments = {
  local: { file: '.env.local', appEnv: 'development' },
  staging: { file: '.env.staging', appEnv: 'staging' },
  production: { file: '.env.production', appEnv: 'production' },
};
const required = [
  'EXPO_PUBLIC_BACKEND_API_URL',
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
];

function selectEnvironment(name) {
  if (!Object.hasOwn(environments, name)) {
    throw new Error('Choose local, staging, or production.');
  }
  return environments[name];
}

function createEnvironment(name, contents, inherited = process.env) {
  const selected = selectEnvironment(name);
  const settings = parseEnv(contents);
  for (const key of required) {
    if (!settings[key]?.trim()) throw new Error(`${selected.file} is missing ${key}.`);
  }
  for (const key of ['EXPO_PUBLIC_BACKEND_API_URL', 'EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_FRONTEND_URL']) {
    if (!settings[key]) continue;
    let url;
    try { url = new URL(settings[key]); } catch { throw new Error(`${key} must be a valid URL.`); }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
      throw new Error(`${key} must be an HTTP(S) URL without credentials, query, or fragment.`);
    }
    if (name !== 'local' && url.protocol !== 'https:') throw new Error(`${key} must use HTTPS for ${name}.`);
  }
  const key = settings.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (/\s/.test(key) || key.startsWith('sb_secret_')) {
    throw new Error('Use a Supabase publishable key, never a secret key.');
  }
  // A legacy anon JWT is also a public client key. Never allow service_role JWTs.
  if (key.split('.').length === 3) {
    let claims;
    try { claims = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()); }
    catch { throw new Error('The Supabase public key is malformed.'); }
    if (claims.role !== 'anon') throw new Error('The Supabase legacy client key must have the anon role.');
  }
  const env = { ...inherited };
  for (const key of Object.keys(env)) {
    if (key.startsWith('EXPO_PUBLIC_')) delete env[key];
  }
  delete env.EXPO_NO_CLIENT_ENV_VARS;
  for (const [key, value] of Object.entries(settings)) {
    if (key.startsWith('EXPO_PUBLIC_')) env[key] = value;
  }
  return { ...env, APP_ENV: selected.appEnv, NODE_ENV: 'development', EXPO_NO_DOTENV: '1' };
}

module.exports = { selectEnvironment, createEnvironment };
