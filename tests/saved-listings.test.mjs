import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveSavedListings} from '../supabase/functions/_shared/saved-listings.mjs';
test('Saved catalogue IDs resolve to canonical deal slugs and readable labels',()=>{
  const [saved]=resolveSavedListings([{kind:'drop',target:'INTERNAL-ID'}],[{id:'INTERNAL-ID',slug:'public-deal',merchant:'Venue',title:'Lunch'}],[]);
  assert.equal(saved.href,'/deals/public-deal');assert.equal(saved.label,'Venue — Lunch');assert.equal(saved.target,'INTERNAL-ID');
});
test('Saved businesses resolve correctly; delisted or missing targets do not expose links',()=>{
  const result=resolveSavedListings([{kind:'merchant',target:'a'},{kind:'merchant',target:'b'},{kind:'drop',target:'missing'}],[],[{id:'a',slug:'venue',name:'Venue',permanent_listing:true,directory_status:'active'},{id:'b',slug:'removed',name:'Removed',permanent_listing:true,directory_status:'removed'}]);
  assert.equal(result[0].href,'/venues/venue');assert.equal(result[1].href,null);assert.equal(result[1].label,'Saved listing unavailable');assert.equal(result[2].href,null);
});
