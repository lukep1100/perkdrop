import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>JSON.parse(readFileSync(new URL(path,import.meta.url),'utf8'));
const metadata=read('../store/google-play.en-AU.json'),app=read('../app.json').expo,eas=read('../eas.json');
test('Google Play copy fits the store limits and keeps the existing package',()=>{
 assert.equal(metadata.packageName,app.android.package);assert.equal(metadata.name,app.name);assert.equal(metadata.version,app.version);
 for(const [key,max] of [['name',30],['shortDescription',80],['fullDescription',4000],['releaseNotes',500]])assert.ok([...metadata[key]].length>0&&[...metadata[key]].length<=max,key);
 for(const key of ['privacyPolicyUrl','deletionUrl','website'])assert.equal(new URL(metadata[key]).origin,'https://perkdrop.au');
});
test('Play build profiles create bundles, keep testing traffic separate and do not enable unverified push',()=>{
 for(const [name,traffic] of [['play-internal','internal'],['play-production','public']]){
  const profile=eas.build[name];assert.equal(profile.distribution,'store');assert.equal(profile.android.buildType,'app-bundle');assert.equal(profile.autoIncrement,true);
  assert.equal(profile.env.EXPO_PUBLIC_TRAFFIC_TYPE,traffic);assert.equal(profile.env.EXPO_PUBLIC_PUSH_ENABLED,'false');assert.equal(eas.submit[name].android.releaseStatus,'draft');
 }
 assert.equal(eas.submit['play-internal'].android.track,'internal');assert.equal(eas.submit['play-production'].android.track,'production');
});
test('draft preparation never invents a Play app, signing certificate or screenshot',()=>{
 assert.equal(metadata.status,'DRAFT_NOT_SUBMITTED');
 for(const key of ['playAppId','versionCode','signedBundleId','uploadKeySha256','playAppSigningSha256'])assert.equal(metadata[key],null,key);
 assert.equal(metadata.featureGraphic,'assets/google-play-feature.png');assert.equal(metadata.appIcon,'assets/google-play-icon.png');assert.deepEqual(metadata.screenshots,[]);assert.match(metadata.dataSafetyStatus,/^REQUIRES_/);assert.equal(app.android.allowBackup,false);
 assert.equal(app.extra.eas.projectId,'3e46f3cc-15c9-40d2-8a4a-6a0c93d977b3');
});
