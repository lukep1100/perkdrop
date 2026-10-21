import test from 'node:test';
import assert from 'node:assert/strict';
import {eventInstant,eventPricing,normalizeEvent,nextOccurrences,parseStructuredEvents,eventLinks,safeUrl} from '../supabase/functions/_shared/event-ingestion.mjs';
import {listingEnded} from '../public/discovery-rules.mjs';
const source={source_url:'https://council.example/events/library-day/',authoritative:true,is_detail:true,page_title:'Library day'};
const merchant={name:'Town Library',primary_city:'adelaide',primary_state:'SA',latitude:-34.9,longitude:138.6};
const event={name:'Library day',url:source.source_url,startDate:'2026-10-25',endDate:'2026-10-25',isAccessibleForFree:true,offers:{price:0},location:{name:'Town Library',address:{streetAddress:'1 Main Street',addressLocality:'Adelaide',addressRegion:'SA'}}};
const now=Date.parse('2026-10-21T00:00Z');
test('date-only events last through the venue local end date',()=>{
 assert.equal(new Date(eventInstant('2026-10-25','Australia/Adelaide')).toISOString(),'2026-10-24T13:30:00.000Z');
 assert.equal(new Date(eventInstant('2026-10-25','Australia/Adelaide',true)).toISOString(),'2026-10-25T13:30:00.000Z');
 assert.equal(new Date(eventInstant('2026-10-25','Australia/Perth',true)).toISOString(),'2026-10-25T16:00:00.000Z');
});
test('offset timestamps retain their actual instant; impossible local times are rejected',()=>{
 assert.equal(eventInstant('2026-10-25T10:30:00+10:30','Australia/Adelaide'),Date.parse('2026-10-25T00:00Z'));
 assert.ok(Number.isNaN(eventInstant('2026-02-30','Australia/Adelaide')));
 assert.ok(Number.isNaN(eventInstant('2026-10-04T02:30:00','Australia/Sydney')));
});
test('a free tier does not incorrectly classify a mixed or ticketed programme as free',()=>{
 assert.equal(eventPricing([{price:0},{price:25}],true).priceKind,'mixed');
 assert.equal(eventPricing({price:0},false).priceKind,'zero_option');
 assert.equal(eventPricing({price:0},true).priceText,'FREE');
 assert.equal(eventPricing({price:25},false).priceText,'From AUD $25.00');
 assert.equal(eventPricing({},false).priceVerified,false);
});
test('structured events parse from JSON-LD graphs and JSON feeds',()=>{
 assert.equal(parseStructuredEvents(JSON.stringify({'@graph':[{'@type':'MusicEvent',...event}]})).length,1);
 assert.equal(parseStructuredEvents(`<script type="application/ld+json">${JSON.stringify({'@type':'Event',...event})}</script>`).length,1);
});
test('verified physical event has explicit dates, local timezone and neutral media',()=>{
 const e=normalizeEvent(event,source,merchant,now);
 assert.equal(e.metadata.auto_publish_eligible,true);assert.equal(e.metadata.timezone,'Australia/Adelaide');
 assert.equal(e.metadata.end_date,'2026-10-25');assert.equal(e.ends_at,'2026-10-25T13:30:00.000Z');
 assert.equal(e.metadata.media_status,'placeholder');
});
test('unrelated sidebar events and external canonical pages are not attributed to this source',()=>{
 assert.equal(normalizeEvent({...event,url:'https://council.example/events/other/'},source,merchant,now),null);
 assert.equal(normalizeEvent({...event,url:'https://other.example/events/library/'},source,merchant,now),null);
});
test('missing coordinates never borrow an unrelated council office location',()=>{
 const e=normalizeEvent({...event,location:{name:'Other Hall',address:{streetAddress:'3 Other Street',addressRegion:'SA'}}},source,merchant,now);
 assert.equal(e.metadata.auto_publish_eligible,false);assert.equal(e.metadata.latitude,null);
});
test('an exact previously verified address can supply coordinates; unknown prices stay explicit',()=>{
 const e=normalizeEvent({...event,offers:{},isAccessibleForFree:false,location:{name:'Other Hall',address:{streetAddress:'3 Other Street',addressRegion:'SA'}}},source,merchant,now,[{state:'SA',address:'3 Other Street, SA',latitude:-34.95,longitude:138.65}]);
 assert.equal(e.metadata.auto_publish_eligible,true);assert.equal(e.price_text,'Check organiser for pricing');assert.equal(e.metadata.price_verified,false);
});
test('ongoing events remain eligible while cancelled and finished events do not',()=>{
 assert.ok(normalizeEvent({...event,startDate:'2026-10-01',endDate:'2026-10-30'},source,merchant,now));
 assert.equal(normalizeEvent({...event,endDate:'2026-10-20'},source,merchant,now),null);
 assert.equal(normalizeEvent({...event,eventStatus:'https://schema.org/EventCancelled'},source,merchant,now).metadata.auto_publish_eligible,false);
});
test('new detail URLs are discovered only on the trusted source host',()=>{
 assert.deepEqual(eventLinks('<a href="/events/new-event/">New</a><a href="https://other.example/events/no/">No</a><a href="/events/new-event/?utm_source=x">Again</a>', 'https://council.example/events/'),['https://council.example/events/new-event/']);
 assert.equal(safeUrl(undefined,source.source_url),'');assert.equal(safeUrl('http://127.0.0.1/a',source.source_url),'');
});
test('cached listings disappear at the exact end timestamp or venue-local midnight',()=>{
 const time=new Date('2026-10-25T13:30:00Z');
 assert.equal(listingEnded({endsAt:time.toISOString()},time),true);
 assert.equal(listingEnded({end:'2026-10-25',state:'SA'},time),true);
 assert.equal(listingEnded({end:'2026-10-25',state:'WA'},time),false);
 assert.equal(listingEnded({end:'2026-10-24',endsAt:'2026-10-26T00:00:00Z',state:'SA'},time),false);
});
test('a recurring programme shows its next real session, not an umbrella and ten duplicate cards',()=>{
 const one=normalizeEvent(event,source,merchant,now),two=normalizeEvent({...event,startDate:'2026-11-01',endDate:'2026-11-01'},source,merchant,now),envelope=normalizeEvent({...event,startDate:'2026-09-01',endDate:'2026-12-01'},source,merchant,now);
 const grouped=nextOccurrences([envelope,two,one],now);
 assert.equal(grouped.length,1);assert.equal(grouped[0].starts_at,one.starts_at);assert.equal(grouped[0].metadata.occurrences.length,2);
 assert.equal(nextOccurrences([envelope,two,one],Date.parse(one.ends_at))[0].starts_at,two.starts_at);
});
