import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const source=await readFile(new URL('supabase/functions/perkdrop-catalogue-api/index.ts',root),'utf8');
const deployedV17SourceSha='81896ce0517c903ccf41a11c7b23bdde42b4bf070fcbe53d783b45a8c5a4803b';
assert.equal(createHash('sha256').update(source.replace(/\r\n/g,'\n')).digest('hex'),deployedV17SourceSha,'source-controlled catalogue function must match the audited v17 source snapshot');
assert.match(source,/version:\"v16-priority-live-capacity\"/);
assert.match(source,/const nextOpen=upcoming\.find\(\(s:any\)=>Number\(s\.capacity_remaining\)>0\)\|\|upcoming\[0\]/,'recurring offers must use the next available session');
assert.match(source,/if\(o\.action_type==='booking_claim'&&s\)return \{\.\.\.o,capacity_total:s\.capacity_total,capacity_remaining:s\.capacity_remaining,next_session:s\}/,'booking claims must derive capacity from offer_sessions');
assert.match(source,/const unit=isFoodLike\(d,merchant\)\?'diner spot':'spot'/,'food capacity must use diner wording');
assert.match(source,/if\(!soldOut&&merchantControlled&&\(exclusive\|\|directLimited\|\|liveClaim\)\)return 600/,'available merchant-controlled Drops must receive top priority');
assert.match(source,/if\(soldOut&&merchantControlled\)return 80/,'sold-out merchant Drops must be demoted');

const app=await readFile(new URL('public/app.js',root),'utf8');
assert.match(app,/\$\{liveSection\}<section class=\"section\"><div class=\"section-head\"><div><div class=\"eyebrow\">DISCOVER<\/div><h2>Worth knowing about<\/h2>/,'live section must render before ordinary discovery');
assert.match(app,/function isLiveMerchantDrop\(d\)\{return Boolean\(d\.merchantOfferId\)&&!isOfferExpired\(d\)&&!isSoldOut\(d\)\}/,'sold-out Drops must not dominate the live section');
assert.match(app,/location\.hostname\.endsWith\('\.vercel\.app'\)/,'Union proof fixture must be preview-host gated');

const live=await fetch('https://khzpdyyywiucfhubxkev.supabase.co/functions/v1/perkdrop-catalogue-api?health=1').then(response=>response.json());
assert.equal(live.ok,true);
assert.equal(live.version,'v16-priority-live-capacity');
console.log('Catalogue priority source, recurring-session capacity, UI ordering and live health checks passed.');
