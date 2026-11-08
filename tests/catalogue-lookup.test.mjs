import test from 'node:test';
import assert from 'node:assert/strict';
import {catalogueSlugFilter} from '../supabase/functions/_shared/catalogue-lookup.mjs';

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
