import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

// Starts a local production Next server and performs GET-only checks. No public
// page JavaScript, accounts, notifications, bookings or analytics are executed.
const port = 3198;
const base = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--port', String(port)], {
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, PERKDROP_APPLE_APP_ID_PREFIX: '', PERKDROP_ANDROID_APP_SIGNING_SHA256: '' },
});
let logs = '';
for (const stream of [child.stdout, child.stderr]) stream.on('data', value => { logs = (logs + value.toString()).slice(-12000); });
let exited = false;
child.on('exit', () => { exited = true; });
const get = path => fetch(base + path, { signal: AbortSignal.timeout(6000), redirect: 'manual' });
try {
  const deadline = Date.now() + 45000;
  let ready = false;
  while (Date.now() < deadline && !exited) {
    try { if ((await get('/app-support')).status === 200) { ready = true; break; } } catch { /* startup only */ }
    await delay(500);
  }
  assert.ok(ready, `Local Next server failed to start. ${logs}`);
  for (const [path, title, required] of [
    ['/app-support', 'App support | PerkDrop', ['PerkDrop app support', 'mailto:perkdropofficial@gmail.com', '/privacy', '/delete-account']],
    ['/privacy', 'Privacy Policy | PerkDrop', ['29 September 2026', 'device-held', 'Supabase', 'Deletion and your choices']],
    ['/delete-account', 'Delete your data | PerkDrop', ['Delete your PerkDrop data', 'mailto:perkdropofficial@gmail.com', 'does not cancel']],
  ]) {
    const response = await get(path);
    assert.equal(response.status, 200, path);
    assert.match(response.headers.get('content-type') || '', /text\/html/);
    const html = await response.text();
    assert.ok(html.includes(`<title>${title}</title>`), `Missing title at ${path}`);
    for (const text of required) assert.ok(html.includes(text), `Missing ${text} at ${path}`);
    console.log(`PUBLIC PAGE PASS: ${path} renders useful support without client JavaScript`);
  }
  for (const path of ['/.well-known/apple-app-site-association', '/.well-known/assetlinks.json']) {
    const response = await get(path);
    assert.equal(response.status, 503, `${path} must fail closed until real signing identifiers exist`);
    assert.match(response.headers.get('content-type') || '', /application\/json/);
    assert.match(response.headers.get('cache-control') || '', /no-store/);
    const document = await response.json();
    assert.deepEqual(path.endsWith('assetlinks.json') ? document : document.applinks.details, []);
    console.log(`ASSOCIATION PASS: ${path} does not publish an invented identity`);
  }
} finally {
  child.kill('SIGTERM');
  await Promise.race([new Promise(resolve => child.once('exit', resolve)), delay(2000)]);
  if (!exited) child.kill('SIGKILL');
}
