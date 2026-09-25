import React from 'react';
import Head from 'next/head';

export default function Privacy() {
  const h = React.createElement;
  const sections = [
    ['Information we use', 'PerkDrop uses a randomly generated app identifier to keep your saved offers and claimed Drops together on your device. When you save or claim an offer, we store that action and the details needed to display and validate your pass. We receive technical request information and may collect usage and referral information when you use the website or its embedded map. If you contact us, we receive the information you choose to send.'],
    ['Location', 'The app asks for location access only when you select Near me. It uses your foreground location to find nearby listings. You can deny or turn off permission in your device settings and still search listings. The embedded website map may also request location while you use it.'],
    ['How we use information', 'We use this information to provide current listings, saved offers, passes and updates, improve the service, prevent misuse and respond to enquiries. Opening an official venue link or directions may take you to a third-party site or mapping app with its own privacy practices.'],
    ['Service providers', 'Supabase hosts PerkDrop catalogue and consumer data. Vercel hosts the website and website analytics. These providers may process information outside Australia. We do not sell your personal information.'],
    ['Your choices and requests', 'You can remove saved offers in the app and revoke location permission in your device settings. To request access, correction or deletion of app data linked to your device identity, email perkdropofficial@gmail.com. We may need information that lets us identify the correct record. Some transaction records may need to be retained for legal or operational reasons.'],
    ['Security and retention', 'We use a device-stored credential to access your saved offers and passes and limit access to service data. We keep information while needed to operate PerkDrop and meet applicable obligations. No internet service can guarantee absolute security.'],
    ['Contact', 'For privacy questions or requests, email perkdropofficial@gmail.com.'],
  ];
  return h(React.Fragment, null,
    h(Head, null, h('title', null, 'Privacy Policy | PerkDrop'), h('meta', { name: 'description', content: 'How the PerkDrop app and website handle information.' }), h('meta', { name: 'viewport', content: 'width=device-width,initial-scale=1' })),
    h('main', { style: { background: '#08090e', color: '#f7f4fb', minHeight: '100vh', padding: '48px 22px', fontFamily: 'system-ui,sans-serif' } },
      h('article', { style: { maxWidth: 720, margin: '0 auto', lineHeight: 1.6, fontSize: 16 } },
        h('a', { href: '/', style: { color: '#d1a8ff' } }, '← PerkDrop'),
        h('h1', { style: { fontSize: 34, lineHeight: 1.2 } }, 'Privacy Policy'),
        h('p', { style: { color: '#bbb5c5' } }, 'Last updated 25 September 2026'),
        h('p', null, 'This policy explains how PerkDrop handles information when you use perkdrop.au and the PerkDrop mobile app.'),
        ...sections.map(([title, body]) => h('section', { key: title, style: { marginTop: 30 } }, h('h2', { style: { fontSize: 21 } }, title), h('p', null, body)))
      )
    )
  );
}
