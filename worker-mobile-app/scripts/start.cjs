const { readFileSync } = require('node:fs');
const { resolve, dirname } = require('node:path');
const { spawn } = require('node:child_process');
const { selectEnvironment, createEnvironment } = require('./environment.cjs');

try {
  const [name, ...args] = process.argv.slice(2);
  const root = resolve(__dirname, '..');
  const selected = selectEnvironment(name);
  let contents;
  try { contents = readFileSync(resolve(root, selected.file), 'utf8'); }
  catch { throw new Error(`Cannot read ${selected.file}. Copy .env.example and supply this environment's settings.`); }
  const env = createEnvironment(name, contents);
  console.log(`Mobile environment: ${name} (${selected.file})`);
  console.log(`Backend: ${env.EXPO_PUBLIC_BACKEND_API_URL}`);
  console.log(`Authentication: ${env.EXPO_PUBLIC_SUPABASE_URL}`);
  console.log('Supabase public key: configured (hidden)');
  if (!args.includes('--check')) {
    const cli = resolve(dirname(require.resolve('expo/package.json')), 'bin/cli');
    const child = spawn(process.execPath, [cli, 'start', '--clear', ...args], {
      cwd: root, env, stdio: 'inherit',
    });
    child.on('error', () => { console.error('Unable to start Expo.'); process.exitCode = 1; });
    child.on('exit', (code, signal) => { process.exitCode = code ?? (signal === 'SIGINT' ? 0 : 1); });
    process.on('SIGINT', () => child.kill('SIGINT'));
    process.on('SIGTERM', () => child.kill('SIGTERM'));
  }
} catch (error) {
  console.error(`Mobile startup stopped: ${error.message}`);
  process.exitCode = 1;
}
