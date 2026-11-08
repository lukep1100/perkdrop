import test from 'node:test';
import assert from 'node:assert/strict';
import {offerAction,offerValue} from '../../public/offer-actions.mjs';
const inventory={redemptionAvailable:true,merchantOfferId:'real-offer',capacityRemaining:2,fulfilmentMode:'direct_claim',source:'https://venue.example/offer'};
test('only live pass inventory can be claimed, including offline and sold-out protection',()=>{
  assert.equal(offerAction(inventory).kind,'claim');
  assert.equal(offerAction({...inventory,capacityRemaining:0}).kind,'unavailable');
  assert.equal(offerAction(inventory,{offline:true}).kind,'unavailable');
  assert.equal(offerAction({...inventory,endsAt:'2020-01-01'}).label,'Offer ended');
  assert.equal(offerAction({...inventory,merchantOfferId:''}).kind,'external');
  assert.equal(offerAction({...inventory,fulfilmentMode:'merchant_confirmation'}).label,'Request confirmation');
});
test('booking-required inventory stays external and prefers the actual booking link',()=>{
  const action=offerAction({...inventory,fulfilmentMode:'booking_claim',merchantBookingUrl:'https://venue.example/book'});
  assert.equal(action.kind,'external');assert.equal(action.url,'https://venue.example/book');assert.equal(action.label,'Book with the venue');
  assert.match(action.note,/does not confirm/);
});
test('public sources are opened directly, unsafe links are discarded, no fake pass is offered',()=>{
  assert.equal(offerAction({official:'https://venue.example/event'}).label,'View at source');
  assert.equal(offerAction({goUrl:'https://venue.example/offer',merchantBookingUrl:'https://booking.example'}).url,'https://venue.example/offer');
  assert.equal(offerAction({official:'javascript:alert(1)'}).kind,'unavailable');
  assert.equal(offerAction({source:'https://name:password@venue.example'}).kind,'unavailable');
  assert.equal(offerAction({official:'bad\\url',source:'https://venue.example'}).url,'https://venue.example/');
});
test('value badges use supplied values and never turn conditional offers into free entry',()=>{
  assert.equal(offerValue({price:'Free'}),'Free entry');
  assert.equal(offerValue({price:'Free',title:'Kids eat free with a paying adult'}),'Conditional offer');
  assert.equal(offerValue({price:'$25',discountPercent:20}),'20% off');
  assert.equal(offerValue({discountPercent:200}),'Check price');
  assert.equal(offerValue({}),'Check price');
});
