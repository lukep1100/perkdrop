import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {nativeShellMode,nativePageUrl,nativeNavigation,readNativeNavigationMessage,nativeSavedIds,nativeSavedScript} from '../../public/native-shell.mjs';

test('embedded chrome requires both the native bridge and an explicit own-site mode',()=>{
  assert.equal(nativeShellMode('https://perkdrop.au/map?native=map',false),'');
  assert.equal(nativeShellMode('https://perkdrop.au/map',true),'');
  assert.equal(nativeShellMode('https://perkdrop.au/map?native=map',true),'map');
  assert.equal(nativeShellMode('https://perkdrop.au/deals/example?native=sheet',true),'sheet');
  assert.equal(nativeShellMode('https://perkdrop.au/search?native=map',true),'');
  assert.equal(nativeShellMode('https://evil.example/map?native=map',true),'');
});
test('native URLs preserve the area while adding the presentation mode',()=>{
  const u=new URL(nativePageUrl('https://perkdrop.au/map?lat=-34.929&lng=138.601&area=Adelaide','map'));
  assert.equal(u.searchParams.get('area'),'Adelaide');
  assert.equal(u.searchParams.get('native'),'map');
  assert.equal(nativePageUrl('https://evil.example/map','map'),null);
  assert.equal(nativePageUrl('https://perkdrop.au/search','map'),null);
});
test('public links return to native Explore/Saved or open a clean detail sheet',()=>{
  assert.deepEqual(nativeNavigation('/search?q=coffee'),{kind:'explore',query:'coffee',category:'All',when:'any'});
  assert.equal(nativeNavigation('/food').category,'Food');
  assert.equal(nativeNavigation('/tonight').when,'tonight');
  assert.deepEqual(nativeNavigation('/my-perks?tab=saved'),{kind:'saved'});
  assert.deepEqual(nativeNavigation('/places/venue%3Aunion-hotel?sid=private&token=private'),{kind:'page',url:'https://perkdrop.au/places/venue%3Aunion-hotel'});
});
test('map messages cannot open foreign or private routes or encoded nested paths',()=>{
  const source='https://perkdrop.au/map?native=map';
  for(const url of ['https://evil.example/deals/a','http://perkdrop.au/deals/a','https://perkdrop.au@evil.example/deals/a','/connect-device?token=private','/plans','/delete-account','javascript:alert(1)','/places/one%2Ftwo','/venues/%zz']) {
    assert.equal(readNativeNavigationMessage(JSON.stringify({type:'perkdrop:navigate',url}),source),null,url);
  }
  assert.equal(readNativeNavigationMessage('{',source),null);
  assert.equal(readNativeNavigationMessage(JSON.stringify({type:'other',url:'/food'}),source),null);
  assert.equal(readNativeNavigationMessage(JSON.stringify({type:'perkdrop:navigate',url:'/food'}),'https://evil.example/map?native=map'),null);
  assert.equal(readNativeNavigationMessage(JSON.stringify({type:'perkdrop:navigate',url:'/food'}),source).category,'Food');
});
test('save messages are bounded public item IDs from map or public detail frames',()=>{
  const message=JSON.stringify({type:'perkdrop:save',id:'PD-2026-0005'});
  assert.deepEqual(readNativeNavigationMessage(message,'https://perkdrop.au/map?native=map'),{kind:'save',id:'PD-2026-0005'});
  assert.deepEqual(readNativeNavigationMessage(message,'https://perkdrop.au/deals/example?native=sheet'),{kind:'save',id:'PD-2026-0005'});
  assert.equal(readNativeNavigationMessage(message,'https://perkdrop.au/connect-device?native=sheet'),null);
  assert.equal(readNativeNavigationMessage(JSON.stringify({type:'perkdrop:save',id:'<script>'}),'https://perkdrop.au/map?native=map'),null);
});
test('saved-state injection exposes only bounded public IDs and dispatches a refresh',()=>{
  const value=['PD-2026-0005','PD-2026-0005','<script>',null];
  assert.deepEqual(nativeSavedIds(value),['PD-2026-0005']);
  let refreshed=false;
  const window={dispatchEvent:event=>{refreshed=event.type==='perkdrop:native-saved';}};
  vm.runInNewContext(nativeSavedScript(value),{window,Event:class{constructor(type){this.type=type;}}});
  assert.deepEqual([...window.PerkDropNativeSaved],['PD-2026-0005']);
  assert.equal(refreshed,true);
});
