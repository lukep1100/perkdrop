const DEAL_SLUG=/^[a-z0-9][a-z0-9_-]{0,159}$/;

// Only canonical first-party deal paths may be surfaced from private plans or
// updates. Do not accept a stored URL: browser parsing of a slash/backslash
// value can turn what looks like a relative path into an external redirect.
export function dealPath(slug){
  const value=String(slug||'').trim();
  return DEAL_SLUG.test(value)?`/deals/${value}`:null;
}
