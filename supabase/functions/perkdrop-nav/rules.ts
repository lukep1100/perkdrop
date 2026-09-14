import { isAustralianPoint } from "../_shared/discovery.ts";
export const validDropId=(id:string)=>/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,119}$/.test(id);
export function navigationDestination(deal:{latitude:unknown;longitude:unknown;location?:string;merchant?:string}){
  // Only canonical database values select the destination, never query-string overrides.
  return isAustralianPoint(deal.latitude,deal.longitude)
    ? `${deal.latitude},${deal.longitude}`
    : String(deal.location||deal.merchant||'').slice(0,500);
}
