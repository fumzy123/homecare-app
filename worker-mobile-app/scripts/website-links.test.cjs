const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function fixture(website, rejectOpen = false) {
  const opened = [];
  const alerts = [];
  const native = {
    Linking: { openURL: async url => {
      opened.push(url);
      if (rejectOpen) throw new Error('No browser available');
    } },
    Alert: { alert: (...args) => alerts.push(args) },
  };
  const filename = path.join(__dirname, '../src/shared/lib/website-links.ts');
  const code = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'exports', 'process', code)(name => {
    assert.equal(name, 'react-native');
    return native;
  }, module.exports, { env: { EXPO_PUBLIC_FRONTEND_URL: website } });
  return { ...module.exports, opened, alerts };
}

test('recovery opens the selected environment website without requiring sign-in or sending account data', async () => {
  for (const website of ['https://staging.example.com/', 'https://app.example.com', 'http://192.168.1.5:5173']) {
    const app = fixture(website);
    await app.openWebsitePage('/forgot-password');
    assert.deepEqual(app.opened, [website.replace(/\/$/, '') + '/forgot-password']);
    assert.deepEqual(app.alerts, []);
  }
});

test('missing or malformed website shows an actionable error without opening another environment', async () => {
  for (const website of [undefined, '', 'not a url', 'javascript:alert(1)', 'https://user:secret@example.com', 'https://example.com?secret=value']) {
    const app = fixture(website);
    await app.openWebsitePage('/forgot-password');
    assert.deepEqual(app.opened, []);
    assert.equal(app.alerts.length, 1);
    assert.match(app.alerts[0][1], /contact your agency/i);
    assert.equal(JSON.stringify(app.alerts).includes('secret'), false);
  }
});

test('browser failure is handled and can be retried', async () => {
  const app = fixture('https://app.example.com', true);
  await app.openWebsitePage('/forgot-password');
  assert.equal(app.alerts[0][0], 'Could not open the page');
});

test('all legal documents use the same configured environment', async () => {
  const app = fixture('https://staging.example.com/');
  for (const page of ['/privacy', '/terms', '/dpa']) await app.openWebsitePage(page);
  assert.deepEqual(app.opened, ['/privacy', '/terms', '/dpa'].map(page => 'https://staging.example.com' + page));
});
