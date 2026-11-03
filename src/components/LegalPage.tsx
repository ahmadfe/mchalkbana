import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

/** Sida för villkor och policyer: rubrik högst upp och läsvänlig text. */
export default function LegalPage({ eyebrow, title, updated, children }: { eyebrow: string; title: string; updated: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <section className="bg-gradient-to-br from-swedish-blue via-brand-700 to-brand-800 text-white py-14 sm:py-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-1 w-8 bg-swedish-yellow rounded-full" />
            <span className="text-swedish-yellow text-sm font-semibold uppercase tracking-widest">{eyebrow}</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold leading-tight">{title}</h1>
          <p className="text-brand-100 text-sm mt-3">Senast uppdaterad {updated}</p>
        </div>
      </section>
      <main className="flex-1 bg-white py-10 sm:py-14">
        <article className="max-w-3xl mx-auto px-4 sm:px-6 text-gray-700 leading-relaxed space-y-8 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-gray-900 [&_h2]:mb-2 [&_a]:text-swedish-blue [&_a]:underline [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_p+p]:mt-2">
          {children}
        </article>
      </main>
      <Footer />
    </div>
  );
}

export const KLARNA_TERMS_URL = 'https://cdn.klarna.com/1.0/shared/content/legal/terms/sv-SE/user';
export const KLARNA_PRIVACY_URL = 'https://cdn.klarna.com/1.0/shared/content/legal/terms/0/sv_se/privacy';
