import { Html, Head, Main, NextScript } from 'next/document';
export default function Document() {
  return <Html lang="en-AU"><Head>
    <link rel="manifest" href="/manifest.webmanifest" />
    <meta name="theme-color" content="#08090e" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="PerkDrop" />
    <link rel="apple-touch-icon" href="/icon.svg" />
  </Head><body><Main /><NextScript /></body></Html>;
}
