import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import FaqSection from '@/components/FaqSection';

export async function generateMetadata() {
  return { title: 'Vanliga frågor – Uppsala Halkbana' };
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
