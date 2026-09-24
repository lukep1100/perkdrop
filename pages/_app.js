const React=require('react');
const {Analytics}=require('@vercel/analytics/next');
const {SpeedInsights}=require('@vercel/speed-insights/next');
const {useRouter}=require('next/router');
module.exports=function PerkDropApp({Component,pageProps}){const router=useRouter();const privatePage=/^\/(perk|recover|my-perks|radar|standby|plans|plan|updates|preferences|admin|social-publishing|claim|unsubscribe|merchant-floor)(\/|$)/.test(router.pathname);return React.createElement(React.Fragment,null,React.createElement(Component,pageProps),!privatePage&&React.createElement(Analytics),!privatePage&&React.createElement(SpeedInsights));};
