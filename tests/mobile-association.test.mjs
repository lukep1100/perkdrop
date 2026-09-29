import test from 'node:test';
import assert from 'node:assert/strict';
import { appleAssociation, androidAssociation } from '../lib/mobile-association.mjs';

test('Apple association does not invent a signing identity', () => {
  for (const prefix of ['', 'bad', 'A'.repeat(11)]) {
    const result = appleAssociation({ PERKDROP_APPLE_APP_ID_PREFIX: prefix });
    assert.equal(result.ready, false);
    assert.deepEqual(result.document.applinks.details, []);
  }
});
test('Apple association is limited to public listing paths', () => {
  const result = appleAssociation({ PERKDROP_APPLE_APP_ID_PREFIX: 'TESTONLY01' });
  assert.equal(result.ready, true);
  assert.deepEqual(result.document.applinks.details[0].appIDs, ['TESTONLY01.au.perkdrop.app']);
  assert.deepEqual(result.document.applinks.details[0].components.map(c => c['/']), ['/deals/*']);
});
test('Android rejects an absent or malformed release fingerprint', () => {
  for (const input of ['', 'debug', 'AA:BB']) {
    assert.equal(androidAssociation({ PERKDROP_ANDROID_APP_SIGNING_SHA256: input }).ready, false);
  }
});
test('Android uses only explicitly supplied certificates', () => {
  const sample = Array(32).fill('AB').join(':');
  const result = androidAssociation({ PERKDROP_ANDROID_APP_SIGNING_SHA256: sample });
  assert.equal(result.ready, true);
  assert.equal(result.document[0].target.package_name, 'au.perkdrop.app');
  assert.deepEqual(result.document[0].target.sha256_cert_fingerprints, [sample]);
});
