import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const text = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Capacitor production wrapper points at the live PerkDrop app', async () => {
  const config = JSON.parse(await text('capacitor.config.json'));
  assert.equal(config.appId, 'au.perkdrop.app');
  assert.equal(config.appName, 'PerkDrop');
  assert.equal(config.webDir, 'mobile/www');
  assert.equal(config.server.url, 'https://perkdrop.au');
  assert.equal(config.server.cleartext, false);
  assert.equal(config.ios.preferredContentMode, 'mobile');
});

test('iOS project is configured for an honest iPhone App Store submission', async () => {
  const info = await text('ios/App/App/Info.plist');
  assert.match(info, /<key>CFBundleDisplayName<\/key>\s*<string>PerkDrop<\/string>/);
  assert.match(info, /<key>NSLocationWhenInUseUsageDescription<\/key>/);
  assert.match(info, /nearby browsing/);
  assert.match(info, /<key>ITSAppUsesNonExemptEncryption<\/key>\s*<false\/>/);

  const project = await text('ios/App/App.xcodeproj/project.pbxproj');
  assert.match(project, /PRODUCT_BUNDLE_IDENTIFIER = au\.perkdrop\.app;/);
  assert.match(project, /MARKETING_VERSION = 1\.0;/);
  assert.doesNotMatch(project, /TARGETED_DEVICE_FAMILY = "1,2";/);
  assert.match(project, /TARGETED_DEVICE_FAMILY = 1;/);
});

test('offline fallback and App Store icon assets are present', async () => {
  const html = await text('mobile/www/index.html');
  assert.match(html, /Retry PerkDrop/);
  assert.match(html, /https:\/\/perkdrop\.au/);

  const icon = await readFile(new URL('../ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png', import.meta.url));
  assert.equal(icon.toString('ascii', 1, 4), 'PNG');
  assert.equal(icon.readUInt32BE(16), 1024);
  assert.equal(icon.readUInt32BE(20), 1024);
  const colorType = icon.readUInt8(25);
  assert.notEqual(colorType, 4, 'App Store icon must not contain alpha transparency');
  assert.notEqual(colorType, 6, 'App Store icon must not contain alpha transparency');
});
