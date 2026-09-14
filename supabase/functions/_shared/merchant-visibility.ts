// Explicit response projection; membership does not imply finance or team access.
export function visibleMerchant(merchant: any, role: string) {
  const output={...merchant};
  const admin=['owner','admin'].includes(role);
  const finance=['owner','admin','manager','analyst'].includes(role);
  if(!admin) for(const key of ['ownership_requests','profile_change_requests','invites','members'])output[key]=[];
  if(!finance){output.commercial_terms=[];output.ledger=[];output.stats_30d={...output.stats_30d};for(const key of ['gross_value','commission_value','fees_accrued'])delete output.stats_30d[key];output.redemptions=(output.redemptions||[]).map((row:any)=>{const r={...row};for(const key of ['gross_value','discount_value','commission_value'])delete r[key];return r;});}
  if(['viewer','analyst'].includes(role))output.redemptions=[];
  return output;
}
