module.exports = {
  images: {
    remotePatterns: [
      {protocol:'https',hostname:'www.datocms-assets.com',port:'',pathname:'/88015/**',search:''},
      {protocol:'https',hostname:'hota.com.au',port:'',pathname:'/uploads/**',search:''},
      {protocol:'https',hostname:'khzpdyyywiucfhubxkev.supabase.co',port:'',pathname:'/functions/v1/perkdrop-union-slideshow',search:'?still=1'},
    ],
    qualities:[75], formats:['image/webp'], maximumResponseBody:8_000_000,
    maximumRedirects:1, dangerouslyAllowLocalIP:false, dangerouslyAllowSVG:false,
    minimumCacheTTL:3600,
  },
  async rewrites() {
    return { afterFiles: [{
      source: '/social-media/:hash([a-f0-9]{64}).png',
      destination: 'https://khzpdyyywiucfhubxkev.supabase.co/storage/v1/object/public/social-publishing/:hash.png',
    }] };
  },
  async headers() {
    return [{source:'/:path*',headers:[
      {key:'X-Content-Type-Options',value:'nosniff'},
      {key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},
    ]},{source:'/social-publishing',headers:[
      {key:'Cache-Control',value:'private, no-store'},
      {key:'X-Robots-Tag',value:'noindex, nofollow'},
      {key:'Referrer-Policy',value:'no-referrer'}
    ]}];
  },
};
