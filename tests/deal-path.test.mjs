import test from 'node:test';
import assert from 'node:assert/strict';
import {dealPath} from '../supabase/functions/_shared/deal-path.mjs';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

test('deal paths are canonical first-party routes only',()=>{
  assert.equal(dealPath('union-hotel-lunch'),'/deals/union-hotel-lunch');
  assert.equal(dealPath('north_adelaide_2026'),'/deals/north_adelaide_2026');
  for(const value of ['', '/\\evil.example', '//evil.example', 'deal?next=https://evil.example', 'deal/path', 'deal%2fpath', 'Deal'])assert.equal(dealPath(value),null);
});

test('consumer links accept first-party absolute detail URLs without encoding the whole URL as a slug',async()=>{
  const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
  const code=source.slice(source.indexOf('  function route(d) {'),source.indexOf('  function navUrl(d) {'));
  const route=vm.runInNewContext(code+';route',{URL});
  for(const detailUrl of ['/deals/gamers175','https://perkdrop.au/deals/gamers175','https://www.perkdrop.au/deals/gamers175'])assert.equal(route({detailUrl,slug:'gamers175'}),'/deals/gamers175');
  assert.equal(route({slug:'gamers175'}),'/deals/gamers175');
  assert.equal(route({id:'PD-EVENT-1'}),'/deals/PD-EVENT-1');
  for(const detailUrl of ['//evil.example','https://evil.example/deals/gamers175','/\\evil.example','javascript:alert(1)']){
    assert.equal(route({detailUrl,slug:'gamers175'}),'/deals/gamers175');
    assert.equal(route({detailUrl}),'/food');
  }
});
