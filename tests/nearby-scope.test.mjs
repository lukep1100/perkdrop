import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';

test('nearby lookup enriches local IDs beyond the national feed cutoff and retains upstream visibility filtering',async()=>{
  const text=await readFile(new URL('../supabase/functions/perkdrop-nearby-api/index.ts',import.meta.url),'utf8');
  const source=stripTypeScriptTypes(text.replace(/^import .*;\n/gm,''));
  let handler,requested;
  const context={URL,Response,Request,crypto,console,setTimeout,
    Deno:{env:{get:key=>key==='SUPABASE_URL'?'https://project.example':'private-test-key'},serve:fn=>handler=fn},
    createClient:()=>({rpc:async()=>({data:[{id:'new-local',distance_km:8},{id:'held-local',distance_km:9}],error:null})}),
    fetch:async value=>{requested=new URL(value);const scoped=requested.searchParams.get('lat')==='-34.9'&&requested.searchParams.get('lng')==='138.6';return new Response(JSON.stringify({deals:scoped?[{id:'new-local',title:'Current local offer'}]:Array.from({length:500},(_,i)=>({id:'national-'+i}))}));},
  };
  vm.runInNewContext(source,context);
  const response=await handler(new Request('https://project.example/nearby?lat=-34.9&lng=138.6&radius_km=25'));
  assert.equal(response.status,200);assert.equal(requested.searchParams.get('radius_km'),'25');
  const payload=await response.json();assert.deepEqual(payload.deals.map(item=>item.id),['new-local']);assert.equal(payload.deals[0].distanceKm,8);
  assert.ok(!JSON.stringify(payload).includes('private-test-key'));
});
