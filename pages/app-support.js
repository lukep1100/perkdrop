import Head from 'next/head';

const linkStyle = { color: '#d6b8ff' };
export default function AppSupport() {
  return <>
    <Head>
      <title>App support | PerkDrop</title>
      <meta name="description" content="Help with PerkDrop location, saved activities, private device links and data deletion." />
      <link rel="canonical" href="https://perkdrop.au/app-support" />
    </Head>
    <main style={{ background: '#08090e', color: '#f7f4fb', minHeight: '100vh', padding: '40px 22px', fontFamily: 'system-ui, sans-serif' }}>
      <article style={{ maxWidth: 720, margin: '0 auto', lineHeight: 1.7 }}>
        <a href="/" style={linkStyle}>← PerkDrop</a>
        <h1>PerkDrop app support</h1>
        <p>Need help finding an activity, accessing saved items or using the app? Contact the PerkDrop team.</p>
        <p><a href="mailto:perkdropofficial@gmail.com?subject=PerkDrop%20app%20support" style={linkStyle}>Email perkdropofficial@gmail.com</a></p>
        <h2>What to include</h2>
        <p>Tell us your phone model, iOS or Android version, app version, what you tried and any error shown. A screenshot can help; hide personal information and private pass details before sending it.</p>
        <p>Never send passwords, verification codes, private device links, device credentials or pass codes.</p>
        <h2>Location and nearby results</h2>
        <p>Location access is optional. Choose a suburb or postcode without granting location permission. Near me uses location while the app is open; you can change permission in your phone settings.</p>
        <h2>Saved items and connected devices</h2>
        <p>Private saves and plans use a device-held guest identity. Use the app’s private device-link feature to connect another device. Keep the link secret; it expires after ten minutes. Email recovery is not currently enabled.</p>
        <h2>Dates, availability and bookings</h2>
        <p>Check the listing’s current dates, conditions and official source before travelling. A listing view or saved item is not a booking. Only rely on the confirmation and instructions actually supplied for the offer. Contact the venue or booking provider about an external booking.</p>
        <h2>Offline and failed requests</h2>
        <p>The app may show a labelled, previously downloaded public catalogue when a refresh fails. Reconnect and refresh for current details. Cached availability cannot be used to issue a claim.</p>
        <h2>Notifications</h2>
        <p>In-app updates are not phone push notifications. Remote alerts are available only in releases where delivery is enabled and you have opted in. An unavailable-alerts message means remote notifications are not enabled for that release.</p>
        <h2>Delete data or ask a privacy question</h2>
        <p>Supported app versions include Settings → Delete PerkDrop data. Review the confirmation carefully: deleting saved data does not cancel an external venue booking.</p>
        <p><a href="/delete-account" style={linkStyle}>Deletion instructions and assistance</a> · <a href="/privacy" style={linkStyle}>Privacy policy</a></p>
      </article>
    </main>
  </>;
}
