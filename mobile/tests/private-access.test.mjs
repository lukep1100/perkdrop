import test from 'node:test';
import assert from 'node:assert/strict';
import { createPrivateAccessGuard } from '../src/private-access.mjs';
const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};

test('current private response is delivered unchanged', async () => {
  const guard = createPrivateAccessGuard();
  const data = { saves: ['local-test-only'] };
  assert.equal(await guard.run(async check => { check(); return data; }), data);
});
test('late response from previous access cannot restore private data', async () => {
  const guard = createPrivateAccessGuard();
  const pending = deferred();
  const result = guard.run(() => pending.promise);
  const rejected = assert.rejects(result, /private access changed/);
  const finish = guard.beginChange();
  finish();
  pending.resolve({ saves: ['old-identity'] });
  await rejected;
});
test('new private requests do not execute while access changes', async () => {
  const guard = createPrivateAccessGuard();
  const finish = guard.beginChange();
  let executed = false;
  await assert.rejects(guard.run(async () => { executed = true; }), /private access changed/);
  assert.equal(executed, false);
  finish();
});
test('checkpoint stops a request before sending with a superseded identity', async () => {
  const guard = createPrivateAccessGuard();
  const pendingIdentity = deferred();
  let sent = false;
  const result = guard.run(async check => { await pendingIdentity.promise; check(); sent = true; });
  const rejected = assert.rejects(result, /private access changed/);
  const finish = guard.beginChange();
  pendingIdentity.resolve();
  await rejected;
  assert.equal(sent, false);
  finish();
});
test('simultaneous pairing/deletion changes are rejected', () => {
  const guard = createPrivateAccessGuard();
  const finish = guard.beginChange();
  assert.throws(() => guard.beginChange(), /being updated/);
  finish();
});
test('failed transition can release access without reviving old responses', async () => {
  const guard = createPrivateAccessGuard();
  const pending = deferred();
  const old = guard.run(() => pending.promise);
  const rejected = assert.rejects(old, /private access changed/);
  const finish = guard.beginChange();
  try { throw Error('simulated connection failure'); } catch { /* expected */ } finally { finish(); }
  assert.equal(await guard.run(async () => 'current'), 'current');
  pending.resolve('old');
  await rejected;
});
test('finishing an earlier change twice cannot unlock a newer one', async () => {
  const guard = createPrivateAccessGuard();
  const first = guard.beginChange();
  first();
  const second = guard.beginChange();
  first();
  await assert.rejects(guard.run(async () => 'blocked'), /private access changed/);
  second();
  assert.equal(await guard.run(async () => 'allowed'), 'allowed');
});
test('ordinary server failures remain failures and do not lock access', async () => {
  const guard = createPrivateAccessGuard();
  await assert.rejects(guard.run(async () => { throw Error('network failure'); }), /network failure/);
  assert.equal(await guard.run(async () => 1), 1);
});
