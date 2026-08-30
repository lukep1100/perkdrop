import React from "react";
import Head from "next/head";
const CATALOGUE_API="https://khzpdyyywiucfhubxkev.supabase.co/functions/v1/perkdrop-catalogue-api?limit=200";
const DEFAULT_TITLE="PerkDrop — Deals near you";
const DEFAULT_DESCRIPTION="PerkDrop — local food deals, drink specials, freebies and events worth knowing about.";

function PerkDropShell({deal}){
 const h=React.createElement;
 const title=deal?`${deal.merchant} — ${deal.title} | PerkDrop`:DEFAULT_TITLE;
 const description=deal?(deal.description||`${deal.title} at ${deal.merchant}. Discover it on PerkDrop.`):DEFAULT_DESCRIPTION;
 const canonical=deal?`https://perkdrop.au/deals/${encodeURIComponent(deal.slug)}`:"https://perkdrop.au/";
 return h(React.Fragment,null,
  h(Head,null,
   h("meta",{charSet:"utf-8"}),h("meta",{name:"viewport",content:"width=device-width,initial-scale=1,viewport-fit=cover,user-scalable=no"}),h("meta",{name:"theme-color",content:"#08090e"}),h("meta",{name:"description",content:description}),h("link",{rel:"canonical",href:canonical}),
   h("meta",{property:"og:type",content:"website"}),h("meta",{property:"og:site_name",content:"PerkDrop"}),h("meta",{property:"og:title",content:title}),h("meta",{property:"og:description",content:description}),h("meta",{property:"og:url",content:canonical}),deal&&deal.image?h("meta",{property:"og:image",content:deal.image}):null,
   h("meta",{name:"twitter:card",content:deal&&deal.image?"summary_large_image":"summary"}),h("meta",{name:"twitter:title",content:title}),h("meta",{name:"twitter:description",content:description}),deal&&deal.image?h("meta",{name:"twitter:image",content:deal.image}):null,
   h("link",{rel:"manifest",href:"/manifest.webmanifest"}),h("link",{rel:"icon",href:"/icon.svg"}),h("title",null,title),h("link",{href:"https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800;900&display=swap",rel:"stylesheet"}),h("link",{rel:"stylesheet",href:"https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css"}),h("link",{rel:"stylesheet",href:"/styles.css?v=v21-capacity-drop"}),h("script",{src:"https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js",defer:true})
  ),
  h("div",{id:"app"},h("div",{className:"boot"},h("img",{src:"/icon.svg",className:"boot-icon",alt:""}),h("div",{className:"boot-logo"},"Perk",h("span",null,"Drop")),h("div",null,"Loading nearby Drops…"))),
  h("script",{src:"/app.js?v=v21-capacity-drop",defer:true})
 );
}

export default PerkDropShell;
export async function getServerSideProps({params}){
 const parts=params&&params.slug;
 if(!Array.isArray(parts)||parts[0]!=="deals"||!parts[1])return {props:{deal:null}};
 try{
  const response=await fetch(CATALOGUE_API,{headers:{accept:"application/json"}});
  if(!response.ok)return {props:{deal:null}};
  const payload=await response.json();
  const deals=Array.isArray(payload)?payload:(payload.deals||[]);
  const requested=parts[1];
  const match=deals.find(x=>x.slug===requested||x.detailUrl===`/deals/${requested}`);
  if(!match)return {props:{deal:null}};
  return {props:{deal:{slug:match.slug||requested,title:match.title||match.offerTitle||"Drop",merchant:match.merchant||match.businessName||"Local venue",description:match.description||match.conditions||"",image:match.image||match.imageUrl||match.mediaUrl||""}}};
 }catch{return {props:{deal:null}};
}
}
