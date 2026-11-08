import { safeWebUrl } from './release-rules.mjs';
import { venueKey } from '../../public/venue-identity.mjs';

// Native Image does not render the catalogue's SVG placeholder as a venue photo.
export function catalogueImage(item) {
  const image = safeWebUrl(item?.image);
  if (!image || /\.svg$/i.test(new URL(image).pathname)) return null;
  return image;
}

// Only use an existing photo from this exact venue/branch, never a nearby venue.
export function selectVenuePhoto(offers = []) {
  const first = offers[0];
  if (!first) return null;
  const key = venueKey(first);
  return offers.find(offer => venueKey(offer) === key && catalogueImage(offer)) || first;
}

export function photoCredit(item) {
  const image = catalogueImage(item);
  if (!image) return null;
  // This supplied exterior is not the parmi/steak poster referenced by older metadata.
  if (image === 'https://perkdrop.au/images/pilot/union-supplied.png') {
    return {caption: 'Union Hotel venue photo · supplied with permission, September 2026', source: image, license: '', licenseUrl: null};
  }
  const credit = item?.imageCredit;
  if (!credit || typeof credit !== 'object' || Array.isArray(credit)) return null;
  const text = value => typeof value === 'string' ? value.trim() : '';
  const result = {caption: text(credit.caption), source: safeWebUrl(credit.source), license: text(credit.license), licenseUrl: safeWebUrl(credit.licenseUrl)};
  return Object.values(result).some(Boolean) ? result : null;
}
