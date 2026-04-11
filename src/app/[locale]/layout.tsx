import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import CookieBanner from '@/components/CookieBanner';
import { AuthProvider } from '@/context/AuthContext';

const locales = ['sv'];

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

const SITE_URL = 'https://www.uppsalahalkbana.se';

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
            {children}
            <CookieBanner />
          </AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
