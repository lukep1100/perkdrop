import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

// Type-checking a TS template does not parse the JavaScript sent to browsers.
for (const name of ['perkdrop-portal', 'perkdrop-booking-page']) {
  test(`${name}: rendered inline JavaScript parses`, async () => {
    const source = await readFile(new URL(`../supabase/functions/${name}/index.ts`, import.meta.url), 'utf8');
    const template = source.match(/const (?:HTML|PAGE)\s*=\s*((?:String.raw)?`[^]*?`);/);
    assert.ok(template, 'expected an HTML template');
    assert.ok(!template[1].includes('${'), 'review new server-side template interpolation before executing it in the test');
    const html = vm.runInNewContext(template[1], {}, {timeout: 1000}).replace('__ATTR_JSON__', '{}');
    const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([^]*?)<\/script>/gi)].map(m => m[1]).filter(Boolean);
    assert.ok(scripts.length > 0, 'expected inline JavaScript');
    scripts.forEach((code, index) => new vm.Script(code, {filename: `${name}-inline-${index}.js`}));
  });
}

test('perkdrop-portal: offer photos are staged for review rather than sent as public URLs', async () => {
  const source = await readFile(new URL('../supabase/functions/perkdrop-portal/index.ts', import.meta.url), 'utf8');
  assert.match(source, /uploadImage\(file,'offer',offerId\)/);
  assert.match(source, /id="offer-media-file"/);
  assert.doesNotMatch(source, /id="offer-media"/);
  assert.doesNotMatch(source, /media_url:media/);
});

test('booking claims never trust a browser booking event as provider confirmation', async () => {
  const [claim,page] = await Promise.all([
    readFile(new URL('../supabase/functions/perkdrop-booking-claim/index.ts', import.meta.url), 'utf8'),
    readFile(new URL('../supabase/functions/perkdrop-booking-page/index.ts', import.meta.url), 'utf8'),
  ]);
  assert.match(claim, /provider_confirmation_not_configured/);
  assert.doesNotMatch(claim, /confirm_booking_hold\s*\(/);
  assert.doesNotMatch(page, /request\(\{action:'confirm'/);
  assert.doesNotMatch(page, /confirmBooking|claim_issued|window\.addEventListener\('message'/);
});

test('native booking opens the provider once and restores with a visible continuation instead of an empty frame',async()=>{
  const source=await readFile(new URL('../supabase/functions/perkdrop-booking-page/index.ts',import.meta.url),'utf8');
  const html=vm.runInNewContext(source.match(/const PAGE\s*=\s*((?:String.raw)?`[^]*?`);/)[1]);
  const helper=html.slice(html.indexOf('function showBookingProvider('),html.indexOf('function startBooking()'));
  const elements={bookingFrame:{style:{}},bookingLink:{},bookingHandoff:{}};
  const opened=[];const location={set href(value){opened.push(value);}};
  const context={el:id=>elements[id],window:{ReactNativeWebView:{postMessage(){}},location},buildWidget:()=> 'https://bookings.nowbookit.com/?date=2026-10-13&covers=2'};
  vm.runInNewContext(helper+'showBookingProvider(true);showBookingProvider(false);',context);
  assert.equal(opened.length,1);assert.equal(elements.bookingFrame.hidden,true);assert.equal(elements.bookingFrame.src,'about:blank');assert.equal(elements.bookingHandoff.hidden,false);assert.equal(elements.bookingLink.href,opened[0]);assert.equal(elements.bookingLink.target,'_self');
  context.window={location};vm.runInNewContext(helper+'showBookingProvider(true)',context);
  assert.equal(opened.length,1);assert.equal(elements.bookingFrame.hidden,false);assert.equal(elements.bookingFrame.src,elements.bookingLink.href);assert.equal(elements.bookingLink.target,'_blank');
});
