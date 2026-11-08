import test from 'node:test';
import assert from 'node:assert/strict';
import {catalogueImage, selectVenuePhoto, photoCredit} from '../src/catalogue-media.mjs';

const venue = {merchant: 'Museum', location: 'North Terrace', city: 'Adelaide'};
const photo = {...venue, image: 'https://perkdrop.au/images/pilot/sa-museum-2011.jpg', imageCredit: {caption: 'David Hearle, 2011', source: 'https://commons.wikimedia.org/wiki/File:South_Australia_museum_1.jpg', license: 'CC BY 2.0', licenseUrl: 'https://creativecommons.org/licenses/by/2.0/'}};
test('uses a real existing catalogue image', () => assert.equal(catalogueImage(photo), photo.image));
for (const image of [null, '', 'javascript:alert(1)', 'https://user:secret@example.test/photo.jpg', 'https://perkdrop.au/images/venue-unavailable.svg', 'https://example.test/placeholder.SVG?width=1200']) {
  test(`does not treat an absent, unsafe or SVG image as a venue photo: ${String(image).slice(0, 70)}`, () => assert.equal(catalogueImage({image}), null));
}
test('prefers a same-branch photo over the first offer placeholder', () => {
  const first = {...venue, image: 'https://perkdrop.au/images/venue-unavailable.svg'};
  assert.equal(selectVenuePhoto([first, photo]), photo);
});
test('never borrows a photo from another branch', () => {
  const first = {...venue, locationId: 'adelaide', image: null};
  assert.equal(selectVenuePhoto([first, {...photo, locationId: 'sydney'}]), first);
});
test('does not replace an existing first photo', () => assert.equal(selectVenuePhoto([photo, {...photo, image: 'https://example.test/other.jpg'}]), photo));
test('handles an empty group', () => assert.equal(selectVenuePhoto([]), null));
test('preserves the selected image attribution and usable licence/source links', () => assert.deepEqual(photoCredit(photo), photo.imageCredit));
test('does not attribute a placeholder to an unrelated photographer', () => assert.equal(photoCredit({...photo, image: 'https://perkdrop.au/images/venue-unavailable.svg'}), null));
test('does not expose unsafe attribution links', () => assert.deepEqual(photoCredit({...photo, imageCredit: {caption: ' Photo ', source: 'javascript:alert(1)', license: ' CC0 ', licenseUrl: 'https://user:secret@example.test/license'}}), {caption: 'Photo', source: null, license: 'CC0', licenseUrl: null}));
test('labels the supplied Union exterior rather than claiming an uncropped meal poster', () => assert.deepEqual(photoCredit({image: 'https://perkdrop.au/images/pilot/union-supplied.png', imageCredit: {caption: 'Original poster displayed uncropped', source: 'https://perkdrop.au/images/pilot/union-steak.png'}}), {caption: 'Union Hotel venue photo · supplied with permission, September 2026', source: 'https://perkdrop.au/images/pilot/union-supplied.png', license: '', licenseUrl: null}));
