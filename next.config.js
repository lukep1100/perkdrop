module.exports = {
  async rewrites() {
    return { afterFiles: [{
      source: '/social-media/:hash([a-f0-9]{64}).png',
      destination: 'https://khzpdyyywiucfhubxkev.supabase.co/storage/v1/object/public/social-publishing/:hash.png',
    }] };
  },
  async headers() {
    return [{source:'/social-publishing',headers:[
      {key:'Cache-Control',value:'private, no-store'},
      {key:'X-Robots-Tag',value:'noindex, nofollow'},
      {key:'Referrer-Policy',value:'no-referrer'}
    ]}];
  },
};
