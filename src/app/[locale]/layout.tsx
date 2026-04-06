import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import CookieBanner from '@/components/CookieBanner';
import { AuthProvider } from '@/context/AuthContext';

const locales = ['sv', 'en'];

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export const metadata: Metadata = {
  title: {
    default: 'Uppsala Halkbana – Riskutbildning',
    template: '%s | Uppsala Halkbana',
  },
  description: 'Boka Risk 1 och Risk 2-utbildning för bil och motorcykel i Uppsala.',
  keywords: ['riskutbildning', 'risk 1', 'risk 2', 'halkbana', 'uppsalahalkbana', 'körskola'],
  openGraph: {
    siteName: 'Uppsala Halkbana',
    locale: 'sv_SE',
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
