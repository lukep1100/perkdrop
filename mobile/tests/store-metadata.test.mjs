import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const metadata = read('../store/app-store.en-AU.json');
const app = read('../app.json').expo;
const eas = read('../eas.json');

test('store identity matches the native app and both package identifiers', () => {
  assert.equal(metadata.name, app.name);
  assert.equal(metadata.version, app.version);
  assert.equal(metadata.bundleIdentifier, app.ios.bundleIdentifier);
  assert.equal(metadata.bundleIdentifier, app.android.package);
});
test('store name and subtitle stay within 30 characters', () => {
  for (const key of ['name', 'subtitle']) assert.ok([...metadata[key]].length > 0 && [...metadata[key]].length <= 30, key);
});
test('keywords and promotional copy stay within store limits', () => {
  assert.ok(Buffer.byteLength(metadata.keywords, 'utf8') <= 100);
  assert.ok([...metadata.promotionalText].length <= 170);
  assert.ok([...metadata.description].length <= 4000);
});
test('support and privacy URLs are public HTTPS without private query fields', () => {
  for (const [key, path] of [['supportUrl', '/app-support'], ['privacyPolicyUrl', '/privacy'], ['deletionUrl', '/delete-account']]) {
    const url = new URL(metadata[key]);
    assert.equal(url.origin, 'https://perkdrop.au');
    assert.equal(url.pathname, path);
    assert.equal(url.search, '');
    assert.equal(url.hash, '');
    assert.equal(url.username, '');
  }
});
test('draft metadata does not invent signing, screenshots or completed questionnaires', () => {
  assert.equal(metadata.status, 'DRAFT_NOT_SUBMITTED');
  assert.equal(metadata.appStoreConnectAppId, null);
  assert.equal(metadata.signedBuildId, null);
  assert.deepEqual(metadata.screenshots, []);
  assert.match(metadata.privacyQuestionnaireStatus, /^REQUIRES_/);
  assert.match(metadata.ageRatingStatus, /^REQUIRES_/);
});
test('test builds remain internal and public release configuration is separate', () => {
  assert.equal(eas.build.preview.env.EXPO_PUBLIC_TRAFFIC_TYPE, 'internal');
  assert.equal(eas.build.testflight.env.EXPO_PUBLIC_TRAFFIC_TYPE, 'internal');
  assert.equal(eas.build.production.env.EXPO_PUBLIC_TRAFFIC_TYPE, 'public');
  assert.equal(eas.build.testflight.distribution, 'store');
  assert.equal(eas.build.production.distribution, 'store');
});
test('this submission preparation does not silently enable push', () => {
  for (const profile of Object.values(eas.build)) assert.equal(profile.env.EXPO_PUBLIC_PUSH_ENABLED, 'false');
  assert.match(metadata.reviewNotes, /Remote push is disabled/);
});
