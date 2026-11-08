import test from 'node:test';
import assert from 'node:assert/strict';
import {appleAssociation,androidAssociation} from '../../lib/mobile-association.mjs';
test('Apple association fails closed without a verified identifier prefix',()=>assert.equal(appleAssociation({}).ready,false));
test('Apple association contains no invented team identifier',()=>assert.deepEqual(appleAssociation({PERKDROP_APPLE_APP_ID_PREFIX:'placeholder'}).document,{applinks:{details:[]}}));
test('Apple association scopes only public deal paths',()=>{
 const result=appleAssociation({PERKDROP_APPLE_APP_ID_PREFIX:'ABCDEFGHIJ'});
 assert.equal(result.ready,true);assert.equal(result.document.applinks.details[0].appIDs[0],'ABCDEFGHIJ.au.perkdrop.app');
 assert.deepEqual(result.document.applinks.details[0].components.map(x=>x['/']),['/deals/*']);
});
test('Android association fails closed without the real signing fingerprint',()=>assert.equal(androidAssociation({}).ready,false));
test('Android association rejects malformed fingerprint lists',()=>assert.equal(androidAssociation({PERKDROP_ANDROID_APP_SIGNING_SHA256:'ab:cd'}).ready,false));
test('Android association supports unique verified release certificates',()=>{
 const fingerprint=Array(32).fill('AB').join(':');
 const result=androidAssociation({PERKDROP_ANDROID_APP_SIGNING_SHA256:fingerprint+','+fingerprint});
 assert.equal(result.ready,true);assert.deepEqual(result.document[0].target.sha256_cert_fingerprints,[fingerprint]);
});
