import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Kontakta oss – Uppsala Halkbana',
  description:
    'Kontakta Uppsala Halkbana – vi hjälper dig med frågor om riskutbildning för bil och motorcykel. Telefon, e-post och adress. Nära Uppsala, Stockholm och Gävle.',
  alternates: { canonical: '/sv/contact' },
  openGraph: {
    title: 'Kontakta oss – Uppsala Halkbana',
    description: 'Har du frågor om riskutbildning? Kontakta oss idag.',
    url: 'https://www.uppsalahalkbana.se/sv/contact',
  },
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
