import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
test('Every event accepted by the tracking API has a database constraint value',async()=>{
  const source=await readFile(new URL('../supabase/functions/perkdrop-track/index.ts',import.meta.url),'utf8');
  const migration=await readFile(new URL('../supabase/migrations/20260914091600_discovery_engagement_events.sql',import.meta.url),'utf8')+await readFile(new URL('../supabase/migrations/20260925085144_audit_discovery_integrity.sql',import.meta.url),'utf8');
  const inputs=JSON.parse(source.match(/const events=new Set\((\[[^]*?\])\)/)[1]);
  const canonical=vm.runInNewContext('('+source.match(/const canonical:Record<string,string>=(\{[^]*?\});/)[1]+')',{}, {timeout:1000});
  for(const input of inputs)assert.ok(migration.includes("'"+(canonical[input]||input)+"'"),input+' must be persisted, not silently rejected');
});
test('Owner analytics reports tracked values only',async()=>{
  const source=await readFile(new URL('../supabase/functions/perkdrop-owner-analytics/index.ts',import.meta.url),'utf8');
  assert.equal(source.includes('estimatedRevenue'),false);
  assert.equal(source.includes('trackedValue'),true);
  assert.equal(source.includes('gross_value'),true);
});
