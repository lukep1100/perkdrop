// Include parent slugs for expanded multi-location detail links. Query the
// indexed candidates directly; a bounded scan of unrelated rows loses new items.
export function catalogueSlugFilter(slug) {
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,159}$/.test(slug)) return null;
  const parts = slug.split('-');
  const prefixes = [...new Set(parts.map((_,i)=>parts.slice(0,i+1).join('-')))];
  return `slug.in.(${prefixes.join(',')}),detail_url.eq./deals/${slug},detail_url.eq.https://perkdrop.au/deals/${slug},detail_url.eq.https://www.perkdrop.au/deals/${slug}`;
}
