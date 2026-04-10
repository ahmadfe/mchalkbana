export const dynamic = 'force-dynamic';

import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import SessionCard from '@/components/SessionCard';
import HomeCardsSection from '@/components/HomeCardsSection';
import FaqSection from '@/components/FaqSection';
import { Shield, Calendar, CreditCard } from 'lucide-react';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import type { Session } from '@/lib/types';

export async function generateMetadata() {
  const t = await getTranslations('home');
  return { title: t('hero_title') };
}

export default async function HomePage({ params }: { params: { locale: string } }) {
  const { locale } = await params;
  const t = await getTranslations('home');

  const now = new Date();
  const [infoCards, authUser, upcomingSessions, heroSettings] = await Promise.all([
    prisma.infoCard.findMany({ orderBy: { sortOrder: 'asc' } }).catch(() => []),
    getAuthUser().catch(() => null),
    prisma.session.findMany({
      where: {
        startTime: { gte: now },
        visibility: 'public',
        seatsAvailable: { gt: 0 },
      },
      orderBy: { startTime: 'asc' },
      take: 3,
      include: { course: true, school: true },
    }).catch(() => []),
    prisma.settings.findMany({ where: { key: { in: ['heroVideoUrl', 'heroImageUrl'] } } }).catch(() => []),
  ]);

  const isAdmin = authUser?.role === 'admin';
  const heroVideoUrl = heroSettings.find((s) => s.key === 'heroVideoUrl')?.value ?? '';
  const heroImageUrl = heroSettings.find((s) => s.key === 'heroImageUrl')?.value ?? '';

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      {/* Hero */}
      <section className="relative bg-gradient-to-br from-swedish-blue via-blue-800 to-blue-900 text-white py-20 md:py-32 overflow-hidden">
        {/* Background media */}
        {heroVideoUrl ? (
          <video
            autoPlay
            muted
            loop
            playsInline
            className="absolute inset-0 w-full h-full object-cover opacity-25"
          >
            <source src={heroVideoUrl} type="video/mp4" />
          </video>
        ) : heroImageUrl ? (
          <div
            className="absolute inset-0 bg-cover bg-center opacity-25"
            style={{ backgroundImage: `url(${heroImageUrl})` }}
          />
        ) : null}
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-gray-950/95 via-cyan-950/80 to-gray-900/90" />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
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
            </div>
          </div>
        </div>
      </section>

      {/* Info Cards — editable by admin */}
      <HomeCardsSection initialCards={infoCards} isAdmin={isAdmin} />

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

      {/* Upcoming sessions — real-time from DB */}
      {upcomingSessions.length > 0 && (
        <section className="py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between mb-10">
              <div>
                <h2 className="section-title">{t('upcoming_sessions')}</h2>
                <p className="section-subtitle">Boka din plats innan de tar slut</p>
              </div>
              <Link href={`/${locale}/courses`} className="hidden md:inline-flex btn-outline text-sm">
                {t('view_all')} →
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {upcomingSessions.map((session) => (
                <SessionCard key={session.id} session={session as unknown as Session} isLoggedIn={false} />
              ))}
            </div>

            <div className="text-center mt-8 md:hidden">
              <Link href={`/${locale}/courses`} className="btn-outline">{t('view_all')}</Link>
            </div>
          </div>
        </section>
      )}

      <FaqSection locale={locale} />

      <Footer />
    </div>
  );
}
