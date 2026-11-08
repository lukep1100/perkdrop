import test from 'node:test';
import assert from 'node:assert/strict';
import {catalogueSlugFilter,catalogueArea} from '../supabase/functions/_shared/catalogue-lookup.mjs';

test('detail lookup reaches a new base or branch item beyond the old thousand-row scan',()=>{
  const rows=Array.from({length:1350},(_,i)=>({id:String(i),slug:'older-'+i}));
  rows.push({id:'new',slug:'gamers175-woodcroft-library-november-december-2026'});
  const requested='gamers175-woodcroft-library-november-december-2026';
  const matches=filter=>{const prefixes=filter.match(/^slug\.in\.\(([^)]+)\)/)[1].split(',');return rows.filter(row=>prefixes.includes(row.slug));};
  assert.deepEqual(matches(catalogueSlugFilter(requested)).map(r=>r.id),['new']);
  assert.deepEqual(matches(catalogueSlugFilter(requested+'-mile-end')).map(r=>r.id),['new']);
});

test('untrusted slugs cannot inject PostgREST filter operators',()=>{
  for(const slug of ['x),active.eq.true','/deals/x','//evil.example','x.y','x%2fy','', 'x'.repeat(161)])assert.equal(catalogueSlugFilter(slug),null,slug);
  assert.match(catalogueSlugFilter('valid_slug'),/detail_url\.eq\.\/deals\/valid_slug/);
});

test('spatial discovery validates Australian coordinates and bounds the public search radius',()=>{
  assert.equal(catalogueArea(new URLSearchParams('limit=500')),null);
  assert.deepEqual(catalogueArea(new URLSearchParams('lat=-34.9&lng=138.6&radius_km=999')),{lat:-34.9,lng:138.6,radius:200});
  for(const query of ['lat=&lng=138','lat=-34&lng=','lat=51&lng=0','lat=-34&lng=138&radius_km=NaN','radius_km=50','lat=-34&lng=138&radius_km=-1'])assert.throws(()=>catalogueArea(new URLSearchParams(query)),RangeError);
});
