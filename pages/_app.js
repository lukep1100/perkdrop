const React=require('react');
const {Analytics}=require('@vercel/analytics/next');
const {SpeedInsights}=require('@vercel/speed-insights/next');

module.exports=function PerkDropApp({Component,pageProps}){
 return React.createElement(React.Fragment,null,
  React.createElement(Component,pageProps),
  React.createElement(Analytics),
  React.createElement(SpeedInsights)
 );
};
