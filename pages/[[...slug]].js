const React=require("react");
const Head=require("next/head").default;
module.exports=function PerkDropShell(){
 const h=React.createElement;
 return h(React.Fragment,null,
  h(Head,null,
   h("meta",{charSet:"utf-8"}),
   h("meta",{name:"viewport",content:"width=device-width,initial-scale=1,viewport-fit=cover,user-scalable=no"}),
   h("meta",{name:"theme-color",content:"#08090e"}),
   h("meta",{name:"description",content:"PerkDrop — local food deals, drink specials, freebies and events worth knowing about."}),
   h("link",{rel:"manifest",href:"/manifest.webmanifest"}),
   h("link",{rel:"icon",href:"/icon.svg"}),
   h("title",null,"PerkDrop — Deals near you"),
   h("link",{href:"https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800;900&display=swap",rel:"stylesheet"}),
   h("link",{rel:"stylesheet",href:"https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css"}),
   h("link",{rel:"stylesheet",href:"/styles.css?v=v20-business-status"}),
   h("script",{src:"https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js",defer:true})
  ),
  h("div",{id:"app"},h("div",{className:"boot"},
   h("img",{src:"/icon.svg",className:"boot-icon",alt:""}),
   h("div",{className:"boot-logo"},"Perk",h("span",null,"Drop")),
   h("div",null,"Loading nearby Drops…")
  )),
  h("script",{src:"/app.js?v=v20-business-status",defer:true})
 );
};