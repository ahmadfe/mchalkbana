import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import type { Metadata, Viewport } from 'next';
import CookieBanner from '@/components/CookieBanner';
import { AuthProvider } from '@/context/AuthContext';
import MetaPixel from '@/components/MetaPixel';
import { PwaSetup } from '@/components/pwa';
import WhatsAppButton from '@/components/WhatsAppButton';

const locales = ['sv'];

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

const SITE_URL = 'https://uppsalahalkbana.se';

export const metadata: Metadata = {
  title: {
    default: 'Uppsala Halkbana – Riskutbildning Risk 1 & Risk 2',
    template: '%s | Uppsala Halkbana',
  },
  description:
    'Boka riskutbildning Risk 1 och Risk 2 för bil och motorcykel i Uppsala, Stockholm och Gävle. Godkänd av Transportstyrelsen. Enkelt att boka online.',
  keywords: [
    'riskutbildning', 'risk 1', 'risk 2', 'halkbana', 'uppsalahalkbana',
    'riskutbildning Uppsala', 'riskutbildning Stockholm', 'riskutbildning Gävle',
    'riskutbildning Enköping', 'riskutbildning Västerås',
    'halkbana Uppsala', 'körskola Uppsala', 'körkort riskutbildning',
    'risk 1 bil', 'risk 2 bil', 'risk 1 motorcykel', 'risk 2 motorcykel',
    'boka riskutbildning', 'riskutbildning online',
  ],
  authors: [{ name: 'Uppsala Halkbana' }],
  creator: 'Uppsala Halkbana',
  publisher: 'Uppsala Halkbana',
  metadataBase: new URL(SITE_URL),
  manifest: '/manifest.webmanifest',
  applicationName: 'Uppsala Halkbana',
  appleWebApp: { capable: true, title: 'Halkbana', statusBarStyle: 'black-translucent' },
  formatDetection: { telephone: false },
  icons: {
    icon: [{ url: '/icons/favicon-32.png', sizes: '32x32', type: 'image/png' }, { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
  },
  alternates: { canonical: '/' },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
  openGraph: {
    type: 'website',
    siteName: 'Uppsala Halkbana',
    locale: 'sv_SE',
    url: SITE_URL,
    title: 'Uppsala Halkbana – Riskutbildning Risk 1 & Risk 2',
    description:
      'Boka riskutbildning Risk 1 och Risk 2 för bil och motorcykel i Uppsala, Stockholm och Gävle. Godkänd av Transportstyrelsen.',
    images: [{ url: '/logo.png', width: 512, height: 512, alt: 'Uppsala Halkbana logotyp' }],
  },
  twitter: {
    card: 'summary',
    title: 'Uppsala Halkbana – Riskutbildning',
    description: 'Boka riskutbildning Risk 1 & Risk 2 i Uppsala, Stockholm och Gävle.',
    images: ['/logo.png'],
  },
};

// viewportFit cover: appen ritar under notchen – sidhuvuden lägger själva till safe-area-marginalen
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#fbf9f8',
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  const { locale } = await params;

  if (!locales.includes(locale)) {
    notFound();
  }

  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider messages={messages}>
          <AuthProvider>
            <MetaPixel />
            <PwaSetup />
            <div className="status-bar-shim" aria-hidden />
            {children}
            <WhatsAppButton />
            <CookieBanner />
          </AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
