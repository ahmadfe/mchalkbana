import { useTranslations } from 'next-intl';
import { getTranslations, getLocale } from 'next-intl/server';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import SessionCard from '@/components/SessionCard';
import { mockSessions } from '@/lib/mockData';
import { Shield, Calendar, CreditCard, CheckCircle2 } from 'lucide-react';
import { prisma } from '@/lib/db';

export async function generateMetadata() {
  const t = await getTranslations('home');
  return { title: t('hero_title') };
}

export default async function HomePage({ params }: { params: { locale: string } }) {
  const { locale } = await params;
  const t = await getTranslations('home');
  const upcomingSessions = mockSessions.filter(s => s.seatsAvailable > 0).slice(0, 3);
  const infoCards = await prisma.infoCard.findMany({
    where: { visible: true },
    orderBy: { sortOrder: 'asc' },
  });

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      {/* Hero */}
      <section className="bg-gradient-to-br from-swedish-blue via-blue-800 to-blue-900 text-white py-20 md:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            {/* Swedish flag accent line */}
            <div className="flex items-center gap-3 mb-6">
              <div className="h-1 w-8 bg-swedish-yellow rounded-full" />
              <span className="text-swedish-yellow text-sm font-semibold uppercase tracking-widest">
                Transportstyrelsen godkänd
              </span>
            </div>

            <h1 className="text-4xl md:text-6xl font-extrabold mb-4 leading-tight">
              {t('hero_title')}
            </h1>
            <p className="text-xl md:text-2xl text-blue-200 font-medium mb-4">
              {t('hero_subtitle')}
            </p>
            <p className="text-blue-100 text-lg mb-10 leading-relaxed max-w-xl">
              {t('hero_desc')}
            </p>

            <div className="flex flex-wrap gap-4">
              <Link href={`/${locale}/courses`} className="btn-secondary text-base">
                {t('book_now')}
              </Link>
              <Link href={`/${locale}/register`} className="btn-outline border-white text-white hover:bg-white hover:text-swedish-blue text-base">
                {t('learn_more')}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="bg-swedish-yellow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { label: 'Godkända kurser', value: '4' },
              { label: 'Nöjda elever', value: '2 400+' },
              { label: 'Platser per pass', value: '20' },
              { label: 'År i branschen', value: '15+' },
            ].map((stat) => (
              <div key={stat.label}>
                <div className="text-3xl font-extrabold text-swedish-blue">{stat.value}</div>
                <div className="text-sm font-medium text-blue-900 mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why us */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="section-title">{t('why_us')}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: <Shield className="w-8 h-8" />,
                title: t('feature_certified'),
                desc: t('feature_certified_desc'),
                color: 'bg-blue-50 text-swedish-blue',
              },
              {
                icon: <Calendar className="w-8 h-8" />,
                title: t('feature_online'),
                desc: t('feature_online_desc'),
                color: 'bg-yellow-50 text-yellow-700',
              },
              {
                icon: <CreditCard className="w-8 h-8" />,
                title: t('feature_safe'),
                desc: t('feature_safe_desc'),
                color: 'bg-green-50 text-green-700',
              },
            ].map((f) => (
              <div key={f.title} className="text-center p-8 rounded-2xl bg-gray-50 border border-gray-100">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5 ${f.color}`}>
                  {f.icon}
                </div>
                <h3 className="font-bold text-gray-900 text-lg mb-2">{f.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Course types info */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="section-title">Våra utbildningar</h2>
            <p className="section-subtitle">Lagstadgade kurser för körkort</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Risk 1 */}
            <div className="card border-l-4 border-l-swedish-blue">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-100 text-swedish-blue flex items-center justify-center font-extrabold text-xl shrink-0">
                  R1
                </div>
                <div>
                  <h3 className="font-bold text-xl text-gray-900 mb-2">Risk 1</h3>
                  <p className="text-gray-500 text-sm leading-relaxed mb-4">
                    Teoretisk utbildning om alkohol, droger, trötthet och riskbeteenden i trafiken. Obligatorisk för alla körkortsaspiranter.
                  </p>
                  <ul className="space-y-1.5">
                    {['Alkohol och droger i trafiken', 'Trötthet och uppmärksamhet', 'Riskgrupper', 'Körtid ca 3 timmar'].map(item => (
                      <li key={item} className="flex items-center gap-2 text-sm text-gray-600">
                        <CheckCircle2 className="w-4 h-4 text-swedish-blue shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4 font-bold text-2xl text-gray-900">1 500 kr</div>
                </div>
              </div>
            </div>

            {/* Risk 2 */}
            <div className="card border-l-4 border-l-orange-500">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center font-extrabold text-xl shrink-0">
                  R2
                </div>
                <div>
                  <h3 className="font-bold text-xl text-gray-900 mb-2">Risk 2</h3>
                  <p className="text-gray-500 text-sm leading-relaxed mb-4">
                    Praktisk körning på halkbana. Lär dig hantera bilen i svåra förhållanden som halka och bromsövningar. Obligatorisk för B-körkort.
                  </p>
                  <ul className="space-y-1.5">
                    {['Halkbanekörning', 'Bromssträckor', 'Undanmanöver', 'Körtid ca 6 timmar'].map(item => (
                      <li key={item} className="flex items-center gap-2 text-sm text-gray-600">
                        <CheckCircle2 className="w-4 h-4 text-orange-500 shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4 font-bold text-2xl text-gray-900">2 500 kr</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Upcoming sessions */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h2 className="section-title">{t('upcoming_sessions')}</h2>
              <p className="section-subtitle">Boka din plats innan de tar slut</p>
            </div>
            <Link
              href={`/${locale}/courses`}
              className="hidden md:inline-flex btn-outline text-sm"
            >
              {t('view_all')} →
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {upcomingSessions.map((session) => (
              <SessionCard key={session.id} session={session} isLoggedIn={false} />
            ))}
          </div>

          <div className="text-center mt-8 md:hidden">
            <Link href={`/${locale}/courses`} className="btn-outline">
              {t('view_all')}
            </Link>
          </div>
        </div>
      </section>

      {/* Info Cards */}
      {infoCards.length > 0 && (
        <section className="py-16" style={{ background: '#fefcf5' }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="section-title">Utbildningar &amp; Tjänster</h2>
              <p className="section-subtitle">Välj den utbildning som passar dig</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {infoCards.map((card) => (
                <div
                  key={card.id}
                  className="bg-white rounded-[28px] overflow-hidden shadow-sm hover:-translate-y-1.5 hover:shadow-lg transition-all duration-300"
                  style={{ border: '1px solid #ece5d8' }}
                >
                  <img
                    src={`https://picsum.photos/seed/${encodeURIComponent(card.imageKeyword)}/800/400`}
                    alt={card.title}
                    className="w-full object-cover"
                    style={{ height: '210px' }}
                  />
                  <div className="p-6">
                    <h3 className="font-bold text-gray-900 mb-2" style={{ fontSize: '1.35rem' }}>{card.title}</h3>
                    {card.price && (
                      <p className="font-semibold mb-3" style={{ color: '#c25d1a' }}>Från {card.price}</p>
                    )}
                    <p className="text-gray-500 text-sm leading-relaxed mb-5">{card.description}</p>
                    <Link
                      href={card.buttonLink}
                      className="inline-flex items-center gap-1.5 font-semibold text-sm transition-colors hover:underline"
                      style={{ color: '#c25d1a' }}
                    >
                      {card.buttonText} →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="py-16 bg-gradient-to-r from-swedish-blue to-blue-700 text-white">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-extrabold mb-4">Redo att boka din riskutbildning?</h2>
          <p className="text-blue-100 text-lg mb-8">
            Skapa ett konto och boka din Risk 1 eller Risk 2-kurs på bara några minuter.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href={`/${locale}/register`} className="btn-secondary text-base px-8">
              Skapa konto gratis
            </Link>
            <Link href={`/${locale}/courses`} className="border-2 border-white text-white font-semibold px-8 py-2.5 rounded-xl hover:bg-white hover:text-swedish-blue transition text-base">
              Se alla kurser
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
