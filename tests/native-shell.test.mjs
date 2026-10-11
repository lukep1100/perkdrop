import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {nativeNavigation,nativeSavedIds} from '../public/native-shell.mjs';
import {validCoordinates} from '../public/discovery-rules.mjs';
const source=await readFile(process.env.PERKDROP_WEB_APP_SOURCE||new URL('../public/app.js',import.meta.url),'utf8');
const extract=(start,end)=>{const a=source.indexOf(start),b=source.indexOf(end,a);assert.ok(a>=0&&b>a);return source.slice(a,b);};
const goSource=extract('  function go(href) {','  function brand()');
function goContext(nativeMode){
  const messages=[],paths=[];
  return {messages,paths,nativeMode,nativeNavigation,URL,UNION:'/deals/union-hotel-20-off-lunch',location:{origin:'https://perkdrop.au',search:''},window:{ReactNativeWebView:{postMessage:message=>messages.push(JSON.parse(message))}},history:{pushState:(_a,_b,path)=>paths.push(path)},state:{},destroyMap(){},scrollTo(){},trackPage(){},render(){}};
}
test('map place links go to the native host without replacing the map document',()=>{
  const context=goContext('map');vm.runInNewContext(goSource+"go('/places/venue%3Aunion-hotel')",context);
  assert.equal(context.paths.length,0);assert.equal(context.messages[0].type,'perkdrop:navigate');
  assert.equal(context.messages[0].url,'https://perkdrop.au/places/venue%3Aunion-hotel');
});
test('map filter/search rerenders retain native mode; browser navigation retains normal routing',()=>{
  const native=goContext('map');vm.runInNewContext(goSource+"go('/map?q=coffee')",native);
  assert.equal(native.messages.length,0);assert.equal(native.paths[0],'/map?q=coffee&native=map');
  const browser=goContext('');vm.runInNewContext(goSource+"go('/food')",browser);
  assert.equal(browser.messages.length,0);assert.equal(browser.paths[0],'/food');
});
test('native shell omits website chrome while normal visitors keep its navigation',()=>{
  const code=extract('  function shell(content, active = "") {','  function searchBox(');
  const context={nativeMode:'map',state:{route:'/map',saved:[],city:'adelaide',locationOpen:false},catalogueNotice:()=>'',footer:()=>'<footer>Footer</footer>',nav:()=>'<nav>Navigation</nav>',brand:()=>'<b>Brand</b>',esc:String,CITIES:{adelaide:['Adelaide']}};
  assert.equal(vm.runInNewContext(code+'shell("<main>Map</main>")',context),'<div class="app-shell native-shell"><main>Map</main></div>');
  context.nativeMode='';const normal=vm.runInNewContext(code+'shell("<main>Map</main>")',context);
  assert.match(normal,/<header/);assert.match(normal,/<nav>/);
});
test('saved-state refresh updates hearts without rerendering or resetting the map',()=>{
  const code=extract('  function syncNativeSaved(){','  window.addEventListener(');
  const attributes={};const button={dataset:{save:'PD-2026-0005'},classList:{contains:()=>true},setAttribute:(name,value)=>attributes[name]=value};
  const context={nativeMode:'map',nativeSavedIds,state:{saved:[]},window:{PerkDropNativeSaved:['PD-2026-0005']},$$:()=>[button]};
  vm.runInNewContext(code+'syncNativeSaved()',context);
  assert.equal(button.textContent,'♥');assert.equal(attributes['aria-pressed'],'true');
  context.window.PerkDropNativeSaved=[];vm.runInNewContext('syncNativeSaved()',context);
  assert.equal(button.textContent,'♡');assert.equal(attributes['aria-pressed'],'false');
});
test('embedded frames never read the separate web guest credential',async()=>{
  const code=extract('  async function loadConsumerState(){','  async function load()');
  const context={nativeMode:'map',store:{get(){throw Error('Native identity must stay private');}}};
  await vm.runInNewContext(code+'loadConsumerState()',context);
});
test('native map uses the requested radius and nationwide mode cannot inherit a web-only area',()=>{
  const code=extract('  const state = {','  const $ = ');
  const context={nativeMode:'map',nativeSavedIds,validCoordinates,CITIES:{adelaide:['Adelaide']},store:{get:()=>'',json:()=>({lat:-34.9,lng:138.6,radius:25})},window:{PerkDropNativeSaved:[]},location:{pathname:'/map'},qs:new URLSearchParams('lat=-34.928&lng=138.601&radius=50')};
  assert.equal(vm.runInNewContext(code+'state.user.radius',context),50);
  context.qs=new URLSearchParams('scope=australia');
  assert.equal(vm.runInNewContext(code+'state.user',{...context}),null);
});
test('nationwide native map includes offers outside the previous web city',()=>{
  const code=extract('  function mapEntries() {','  function venueCard(');
  const deals=[{id:'adelaide'},{id:'sydney'}];
  const context={nativeMode:'map',qs:new URLSearchParams('scope=australia'),state:{user:null,deals,businesses:[],query:'',mapFilter:'offers'},mapped:()=>true,searchMatches:()=>true,text:()=>'',cityDeals:()=>[deals[0]],venueGroups:rows=>rows.map(primary=>({primary,offers:[primary]})),placeKey:d=>d.id};
  assert.equal(vm.runInNewContext(code+'mapEntries().length',context),2);
  context.nativeMode='';assert.equal(vm.runInNewContext(code+'mapEntries().length',context),1);
});
