const manifest = {
  id: '/',
  name: 'PerkDrop',
  short_name: 'PerkDrop',
  start_url: '/',
  scope: '/',
  display: 'standalone',
  orientation: 'portrait-primary',
  background_color: '#08090e',
  theme_color: '#08090e',
  description: 'Deals worth knowing about.',
  categories: ['shopping', 'food', 'travel'],
  icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
};

export async function getServerSideProps({ res }) {
  res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600');
  res.status(200).send(JSON.stringify(manifest));
  return { props: {} };
}

export default function Manifest() {
  return null;
}
