export const dynamic = 'force-dynamic';

import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import SessionCard from '@/components/SessionCard';
import HomeCardsSection from '@/components/HomeCardsSection';
import FaqSection from '@/components/FaqSection';
import { Shield, BookOpen, Users, MapPin, CheckCircle2, Star } from 'lucide-react';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import type { Session } from '@/lib/types';

export async function generateMetadata() {
  return { title: 'Uppsala Halkbana – Riskutbildning Risk 1 & Risk 2' };
}

export default async function HomePage({ params }: { params: { locale: string } }) {
  const { locale } = await params;
  const t = await getTranslations('home');

  const now = new Date();
  const [infoCards, authUser, upcomingSessions, heroSettings] = await Promise.all([
    prisma.infoCard.findMany({ orderBy: { sortOrder: 'asc' } }).catch(() => []),
    getAuthUser().catch(() => null),
    prisma.session.findMany({
      where: { startTime: { gte: now }, visibility: 'public', seatsAvailable: { gt: 0 } },
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
    <div className="min-h-screen flex flex-col bg-[#fbf9f8]">
      <Navbar />

      {/* ─── HERO ─────────────────────────────────────────────── */}
      <section className="relative min-h-[35vh] sm:min-h-[40vh] flex items-center overflow-hidden bg-gray-950">
        {/* Background media */}
        {heroVideoUrl ? (
          <video autoPlay muted loop playsInline className="absolute inset-0 w-full h-full object-cover opacity-40">
            <source src={heroVideoUrl} type="video/mp4" />
          </video>
        ) : heroImageUrl ? (
          <div className="absolute inset-0 bg-cover bg-center opacity-40" style={{ backgroundImage: `url(${heroImageUrl})` }} />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-gray-950 via-cyan-950 to-gray-900" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-gray-950/90 via-gray-950/60 to-transparent sm:bg-gradient-to-r sm:from-gray-950/95 sm:via-gray-950/60 sm:to-transparent" />

        <div className="relative z-10 max-w-7xl mx-auto px-5 sm:px-8 w-full py-16 sm:py-24">
          <div className="max-w-xl">
            <span className="inline-block py-1 px-3 bg-swedish-blue/20 text-swedish-blue border border-swedish-blue/30 rounded-full text-xs font-bold uppercase tracking-widest mb-4 sm:mb-6">
              Transportstyrelsen Godkänd
            </span>
            <h1 className="font-headline text-4xl sm:text-5xl md:text-6xl font-extrabold text-white leading-[1.1] tracking-tight mb-4 sm:mb-6">
              Uppsala Halkbana
            </h1>
            <p className="text-base sm:text-lg text-gray-300 mb-8 sm:mb-10 leading-relaxed font-medium max-w-md">
              Professionell riskutbildning för bil och motorcykel. Erfarna instruktörer, moderna anläggningar, enkelt att boka.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href={`/sv/courses`}
                className="px-6 py-3.5 bg-swedish-blue text-white rounded-xl font-bold text-sm sm:text-base hover:bg-swedish-dark transition-all shadow-lg shadow-swedish-blue/20 hover:shadow-xl hover:-translate-y-0.5 text-center"
              >
                Boka Riskutbildning
              </Link>
              <Link
                href={`/sv/courses`}
                className="px-6 py-3.5 bg-white/10 text-white border border-white/20 rounded-xl font-bold text-sm sm:text-base hover:bg-white/20 transition-all text-center backdrop-blur-sm"
              >
                Våra Kurser →
              </Link>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 opacity-40">
          <div className="w-0.5 h-6 bg-white rounded-full animate-pulse" />
        </div>
      </section>

      {/* ─── INFO CARDS (admin-editable) ─────────────────────── */}
      <HomeCardsSection initialCards={infoCards} isAdmin={isAdmin} />

      {/* ─── COURSE CARDS BENTO ──────────────────────────────── */}
      <section className="py-24 bg-[#f5f3f3]">
        <div className="max-w-7xl mx-auto px-6 sm:px-8">
          <div className="mb-14">
            <p className="text-xs font-bold text-swedish-blue uppercase tracking-widest mb-3">Vad vi erbjuder</p>
            <h2 className="font-headline text-3xl md:text-4xl font-extrabold text-gray-900">Våra Utbildningar</h2>
            <div className="h-1 w-16 bg-swedish-blue rounded-full mt-4" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Risk 1 */}
            <div className="group bg-white p-8 rounded-2xl border border-gray-100 hover:-translate-y-1.5 transition-all duration-300 shadow-sm hover:shadow-lg">
              <div className="w-14 h-14 bg-swedish-blue/10 rounded-2xl flex items-center justify-center mb-6">
                <BookOpen className="w-7 h-7 text-swedish-blue" />
              </div>
              <h3 className="font-headline text-xl font-bold mb-3 text-gray-900">Risk 1 – Teori</h3>
              <p className="text-gray-500 text-sm leading-relaxed mb-6">
                Obligatorisk utbildning om alkohol, droger, trötthet och riskbeteenden i trafiken. Genomförs i grupp med erfaren instruktör.
              </p>
              <div className="pt-5 border-t border-gray-100 flex items-center justify-between">
                <span className="font-bold text-gray-900">Från 900 kr</span>
                <Link href={`/sv/courses`} className="text-swedish-blue hover:text-swedish-dark font-semibold text-sm flex items-center gap-1 transition-colors">
                  Boka <span className="opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                </Link>
              </div>
            </div>

            {/* Risk 2 – highlighted */}
            <div className="group bg-gray-950 text-white p-8 rounded-2xl shadow-2xl shadow-gray-900/30 hover:-translate-y-1.5 transition-all duration-300 relative overflow-hidden">
              <div className="absolute top-4 right-4">
                <span className="bg-swedish-blue text-white px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase">Populär</span>
              </div>
              <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center mb-6">
                <Shield className="w-7 h-7 text-swedish-blue" />
              </div>
              <h3 className="font-headline text-xl font-bold mb-3">Risk 2 – Halkbana</h3>
              <p className="text-white/70 text-sm leading-relaxed mb-6">
                Praktisk körning på halt underlag. Lär dig hantera fordonet vid kritiska situationer på vår moderna halkbana i Uppsala.
              </p>
              <div className="pt-5 border-t border-white/10 flex items-center justify-between">
                <span className="font-bold">Från 2 200 kr</span>
                <Link href={`/sv/courses`} className="text-swedish-blue hover:text-cyan-300 font-semibold text-sm flex items-center gap-1 transition-colors">
                  Boka →
                </Link>
              </div>
            </div>

            {/* MC */}
            <div className="group bg-white p-8 rounded-2xl border border-gray-100 hover:-translate-y-1.5 transition-all duration-300 shadow-sm hover:shadow-lg">
              <div className="w-14 h-14 bg-swedish-blue/10 rounded-2xl flex items-center justify-center mb-6">
                <Users className="w-7 h-7 text-swedish-blue" />
              </div>
              <h3 className="font-headline text-xl font-bold mb-3 text-gray-900">Risk 2 – Motorcykel</h3>
              <p className="text-gray-500 text-sm leading-relaxed mb-6">
                Riskutbildning del 2 anpassad för motorcykelförare. Praktiska övningar på halkbana med fokus på bromsar och styrning.
              </p>
              <div className="pt-5 border-t border-gray-100 flex items-center justify-between">
                <span className="font-bold text-gray-900">Från 2 600 kr</span>
                <Link href={`/sv/courses`} className="text-swedish-blue hover:text-swedish-dark font-semibold text-sm flex items-center gap-1 transition-colors">
                  Boka <span className="opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── UPCOMING SESSIONS ───────────────────────────────── */}
      {upcomingSessions.length > 0 && (
        <section className="py-24 bg-white">
          <div className="max-w-7xl mx-auto px-6 sm:px-8">
            <div className="flex items-end justify-between mb-12">
              <div>
                <p className="text-xs font-bold text-swedish-blue uppercase tracking-widest mb-2">Lediga platser</p>
                <h2 className="font-headline text-3xl font-extrabold text-gray-900">Kommande Kurstillfällen</h2>
              </div>
              <Link href={`/sv/courses`} className="hidden md:inline-flex items-center gap-2 text-sm font-semibold text-swedish-blue hover:text-swedish-dark border border-swedish-blue/30 px-4 py-2 rounded-xl transition-colors">
                Visa alla →
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {upcomingSessions.map((session) => (
                <SessionCard key={session.id} session={session as unknown as Session} isLoggedIn={false} />
              ))}
            </div>
            <div className="text-center mt-8 md:hidden">
              <Link href={`/sv/courses`} className="btn-outline">{t('view_all')}</Link>
            </div>
          </div>
        </section>
      )}

      {/* ─── WHY CHOOSE US ───────────────────────────────────── */}
      <section className="py-24 bg-[#fbf9f8]">
        <div className="max-w-7xl mx-auto px-6 sm:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
            {/* Left: stat cards */}
            <div className="grid grid-cols-2 gap-4">
              {[
                { value: '15+', label: 'Års erfarenhet', color: 'bg-swedish-blue text-white' },
                { value: '2 400+', label: 'Nöjda elever', color: 'bg-gray-900 text-white' },
                { value: '100%', label: 'Godkänd av Transportstyrelsen', color: 'bg-[#f5f3f3] text-gray-900' },
                { value: '4.9★', label: 'Genomsnittligt betyg', color: 'bg-[#f5f3f3] text-gray-900' },
              ].map((s) => (
                <div key={s.label} className={`${s.color} rounded-2xl p-6`}>
                  <p className="font-headline text-3xl font-extrabold mb-1">{s.value}</p>
                  <p className="text-sm font-medium opacity-80">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Right: text */}
            <div>
              <p className="text-xs font-bold text-swedish-blue uppercase tracking-widest mb-3">Varför välja oss</p>
              <h2 className="font-headline text-3xl md:text-4xl font-extrabold text-gray-900 mb-8 leading-tight">
                Uppsala Halkbana – din partner för säkrare körning
              </h2>
              <ul className="space-y-6">
                {[
                  {
                    icon: <Shield className="w-5 h-5" />,
                    title: 'Högsta säkerhetsstandard',
                    desc: 'Alla kurser uppfyller Transportstyrelsens krav. Vi kompromissar aldrig med säkerheten.',
                  },
                  {
                    icon: <CheckCircle2 className="w-5 h-5" />,
                    title: 'Moderna pedagogiska metoder',
                    desc: 'Utbildningar anpassade efter dagens trafikmiljö med erfarna och certifierade instruktörer.',
                  },
                  {
                    icon: <MapPin className="w-5 h-5" />,
                    title: 'Centralt belägen anläggning',
                    desc: 'Lättillgänglig halkbana i Uppsala-regionen med goda parkeringsmöjligheter.',
                  },
                ].map((item) => (
                  <li key={item.title} className="flex gap-4">
                    <div className="flex-shrink-0 w-10 h-10 bg-swedish-blue/10 rounded-xl flex items-center justify-center text-swedish-blue">
                      {item.icon}
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 mb-1">{item.title}</h4>
                      <p className="text-gray-500 text-sm leading-relaxed">{item.desc}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ─── TESTIMONIALS ────────────────────────────────────── */}
      <section className="py-24 bg-gray-950 text-white overflow-hidden relative">
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-0 left-0 w-96 h-96 bg-swedish-blue rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-swedish-blue rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
        </div>
        <div className="max-w-7xl mx-auto px-6 sm:px-8 relative z-10">
          <div className="text-center mb-14">
            <p className="text-xs font-bold text-swedish-blue uppercase tracking-widest mb-3">Recensioner</p>
            <h2 className="font-headline text-3xl font-extrabold">Vad våra elever säger</h2>
            <p className="text-white/50 mt-2">Över 2 400 nöjda elever har startat sin resa hos oss.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                text: 'Risktvåan var både lärorik och faktiskt riktigt rolig! Instruktörerna var lugna, professionella och förklarade allt tydligt.',
                name: 'Erik Karlsson',
                role: 'Tidigare elev',
                initials: 'EK',
              },
              {
                text: 'Väldigt bra bemötande och ett perfekt upplägg. Kände mig trygg hela vägen. Kan varmt rekommendera Uppsala Halkbana!',
                name: 'Sara Lindström',
                role: 'Tidigare elev',
                initials: 'SL',
              },
              {
                text: 'Proffsig anläggning och tydliga instruktioner. Motorcykelkursen var fantastisk – lärde mig massor på kort tid.',
                name: 'Marcus Andersson',
                role: 'Tidigare elev',
                initials: 'MA',
              },
            ].map((r) => (
              <div key={r.name} className="bg-white/5 backdrop-blur-sm p-7 rounded-2xl border border-white/10">
                <div className="flex gap-0.5 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-white/80 italic mb-6 leading-relaxed text-sm">&ldquo;{r.text}&rdquo;</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-swedish-blue flex items-center justify-center text-white font-bold text-xs">
                    {r.initials}
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{r.name}</p>
                    <p className="text-white/40 text-xs">{r.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── TRUST SIGNALS ───────────────────────────────────── */}
      <section className="py-14 bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 sm:px-8">
          <p className="text-center text-gray-400 font-bold uppercase tracking-widest text-xs mb-8">
            Auktoriserad & certifierad partner
          </p>
          <div className="flex flex-wrap justify-center items-center gap-12 md:gap-20 opacity-50 grayscale hover:opacity-80 hover:grayscale-0 transition-all duration-500">
            {[
              { label: 'Transportstyrelsen', icon: '🛡️' },
              { label: 'NTF', icon: '🏅' },
              { label: 'STR Medlem', icon: '📋' },
              { label: 'Säker Trafik', icon: '✅' },
            ].map((p) => (
              <div key={p.label} className="flex items-center gap-2">
                <span className="text-2xl">{p.icon}</span>
                <span className="font-headline font-bold text-gray-900">{p.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FAQ ─────────────────────────────────────────────── */}
      <FaqSection locale={locale} />

      <Footer />
    </div>
  );
}
