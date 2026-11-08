import test from 'node:test';
import assert from 'node:assert/strict';
import {releaseConfig} from '../../scripts/mobile-release.mjs';
const app={expo:{version:'1.1.0',ios:{bundleIdentifier:'au.perkdrop.app'}}};
const manifest={version:'1.1.0',buildNumber:'12',channel:'testflight',pushEnabled:true};
test('release configuration targets the existing app and an explicit opt-in push mode',()=>{
  assert.deepEqual(releaseConfig(manifest,app),{version:'1.1.0',buildNumber:'12',pushEnabled:true});
  assert.equal(releaseConfig(manifest,app,{buildNumber:'13',pushEnabled:false}).pushEnabled,false);
});
test('a release fails closed on a wrong version, identity, channel, unsafe build number or implicit push setting',()=>{
  for(const patch of [{version:'2.0'},{channel:'app-store'},{buildNumber:'11'},{buildNumber:'12\nSECRET=x'},{pushEnabled:'true'}])assert.throws(()=>releaseConfig({...manifest,...patch},app));
  assert.throws(()=>releaseConfig(manifest,{expo:{...app.expo,ios:{bundleIdentifier:'another.app'}}}));
});
