import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Kurser – Riskutbildning Risk 1 & Risk 2',
  description:
    'Se alla tillgängliga kurstillfällen för riskutbildning Risk 1 och Risk 2 för bil och motorcykel. Boka enkelt online – Uppsala, Stockholm, Gävle.',
  alternates: { canonical: '/sv/courses' },
  openGraph: {
    title: 'Kurser – Uppsala Halkbana',
    description:
      'Boka riskutbildning Risk 1 och Risk 2 för bil och motorcykel. Välj datum och säkra din plats online.',
    url: 'https://www.uppsalahalkbana.se/sv/courses',
  },
};

export default function CoursesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
