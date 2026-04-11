import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import FaqSection from '@/components/FaqSection';

export async function generateMetadata() {
  return {
    title: 'Vanliga frågor – Uppsala Halkbana',
    description:
      'Svar på vanliga frågor om riskutbildning Risk 1 och Risk 2 för bil och motorcykel. Vad tar du med? Hur fungerar det? Boka enkelt online.',
    alternates: { canonical: '/sv/faq' },
    openGraph: {
      title: 'Vanliga frågor – Uppsala Halkbana',
      description: 'Allt du behöver veta om riskutbildning Risk 1 och Risk 2.',
      url: 'https://www.uppsalahalkbana.se/sv/faq',
    },
  };
}

export default async function FaqPage({ params }: { params: { locale: string } }) {
  const { locale } = await params;
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        <FaqSection locale={locale} />
      </main>
      <Footer />
    </div>
  );
}
