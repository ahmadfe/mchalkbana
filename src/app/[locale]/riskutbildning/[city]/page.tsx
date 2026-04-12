import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { prisma } from '@/lib/db';
import { CITIES, getCityBySlug } from '@/lib/cities';
import { CheckCircle2, MapPin, Clock, Car, Bike, ArrowRight, Star, ShieldCheck } from 'lucide-react';

export async function generateStaticParams() {
  return CITIES.map((c) => ({ city: c.slug }));
}

export async function generateMetadata({ params }: { params: { city: string; locale: string } }): Promise<Metadata> {
  const city = getCityBySlug(params.city);
  if (!city) return {};

  const title = `Riskutbildning ${city.name} | Uppsala Halkbana`;
  const description = `Boka riskutbildning Risk 1 och Risk 2 nära ${city.name}. Bil och motorcykel. Godkänd av Transportstyrelsen. Endast ${city.distance} km från ${city.name} – boka online idag!`;

  return {
    title,
    description,
    keywords: [
      `riskutbildning ${city.name}`,
      `risk 1 ${city.name}`,
      `risk 2 ${city.name}`,
      `halkbana nära ${city.name}`,
      `körkortsutbildning ${city.name}`,
      `riskutbildning motorcykel ${city.name}`,
      `boka riskutbildning ${city.name}`,
      `halkövning ${city.name}`,
      'riskutbildning',
      'halkbana Uppsala',
      'risk 1 bil',
      'risk 2 bil',
      'risk 1 MC',
      'risk 2 MC',
      'mopedutbildning',
      'AM-körkort',
    ].join(', '),
    alternates: { canonical: `/sv/riskutbildning/${params.city}` },
    openGraph: {
      title,
      description,
      url: `https://www.uppsalahalkbana.se/sv/riskutbildning/${params.city}`,
      images: [{ url: '/logo.png', width: 512, height: 512, alt: 'Uppsala Halkbana' }],
    },
  };
}

const COURSES = [
  {
    code: 'R1',
    title: 'Risk 1 – Bil',
    badge: 'B-körkort',
    color: 'bg-cyan-50 border-cyan-200',
    badgeColor: 'bg-swedish-blue text-white',
    icon: <Car className="w-5 h-5" />,
    description: 'Obligatorisk riskutbildning för B-körkort. Teori och praktisk halkövning. Lär dig hantera bilen i kritiska situationer.',
    bullets: ['Halkövning på bana', 'Nödbromsteknik', 'Godkänd av Transportstyrelsen'],
    price: 'Fr. 2 500 kr',
    href: '/sv/courses',
  },
  {
    code: 'R2',
    title: 'Risk 2 – Bil',
    badge: 'B-körkort',
    color: 'bg-amber-50 border-amber-200',
    badgeColor: 'bg-swedish-yellow text-gray-900',
    icon: <Car className="w-5 h-5" />,
    description: 'Fördjupad riskutbildning om alkohol, droger och trötthet. Teori, gruppdiskussion och praktiska moment.',
    bullets: ['Alkohol & droger i trafiken', 'Trötthetsrisk', 'Interaktiva gruppdiskussioner'],
    price: 'Fr. 1 800 kr',
    href: '/sv/courses',
  },
  {
    code: 'R1MC',
    title: 'Risk 1 – Motorcykel',
    badge: 'A-körkort',
    color: 'bg-gray-50 border-gray-200',
    badgeColor: 'bg-gray-800 text-white',
    icon: <Bike className="w-5 h-5" />,
    description: 'Riskutbildning anpassad för motorcykel. Bromsteknik, undanmanöver och halkövning på specialanpassad bana.',
    bullets: ['Bromsteknik & undanmanöver', 'Halkövning med MC', 'Specialanpassad bana'],
    price: 'Fr. 2 800 kr',
    href: '/sv/courses',
  },
  {
    code: 'R2MC',
    title: 'Risk 2 – Motorcykel',
    badge: 'A-körkort',
    color: 'bg-orange-50 border-orange-200',
    badgeColor: 'bg-orange-500 text-white',
    icon: <Bike className="w-5 h-5" />,
    description: 'Fördjupad riskutbildning för motorcykelförare. Psykologiska och medicinska riskfaktorer. Godkänd av Transportstyrelsen.',
    bullets: ['Alkohol & droger på MC', 'Trötthets & stresshantering', 'Interaktiv teorigenomgång'],
    price: 'Fr. 1 800 kr',
    href: '/sv/courses',
  },
  {
    code: 'AM',
    title: 'AM-körkort – Moped',
    badge: 'Moped / EU-moped',
    color: 'bg-green-50 border-green-200',
    badgeColor: 'bg-green-600 text-white',
    icon: <Car className="w-5 h-5" />,
    description: 'Utbildning för moped klass I (EU-moped). Teori och praktik för säker mopedkörning. Öppen för ungdomar från 15 år.',
    bullets: ['Teori & praktik', 'EU-moped klass I', 'Från 15 år'],
    price: 'Fr. 1 200 kr',
    href: '/sv/courses',
  },
];

const FAQ = (cityName: string) => [
  {
    q: `Hur långt är det från ${cityName} till Uppsala Halkbana?`,
    a: `Från ${cityName} tar det ungefär ${getCityBySlug('')?.driveMinutes ?? 45} minuter med bil. Vi ligger i Alunda, Norrlövsta 147 – lätt att hitta och med goda parkeringsmöjligheter.`,
  },
  {
    q: 'Vad är skillnaden mellan Risk 1 och Risk 2?',
    a: 'Risk 1 fokuserar på praktisk körning i kritiska situationer – halka, nödstopp och undanmanövrar. Risk 2 handlar om de mänskliga faktorerna: alkohol, droger, trötthet och stress i trafiken. Båda är obligatoriska för B-körkort.',
  },
  {
    q: 'Kan jag göra Risk 1 och Risk 2 samma dag?',
    a: 'Ja! Vi erbjuder kombinerade tillfällen där du klarar av båda på en och samma dag. Perfekt för dig som vill minimera resor från ' + cityName + '.',
  },
  {
    q: 'Hur bokar jag riskutbildning?',
    a: 'Du bokar enkelt online direkt på vår hemsida. Välj kurs, välj datum och betala säkert med Swish eller kort. Du får bekräftelse direkt via e-post.',
  },
  {
    q: 'Gäller riskutbildningen för både bil och motorcykel?',
    a: 'Nej, Risk 1 och Risk 2 är separata för bil (B-körkort) respektive motorcykel (A-körkort). Du behöver genomföra rätt kurs för det körkort du tar.',
  },
  {
    q: `Finns det parkering vid halkbanan?`,
    a: 'Ja, vi har gratis parkering direkt vid anläggningen i Alunda. Lätt att ta sig hit från ' + cityName + ' med bil.',
  },
];

export default async function CityPage({ params }: { params: { city: string; locale: string } }) {
  const city = getCityBySlug(params.city);
  if (!city) notFound();

  const now = new Date();
  const upcomingSessions = await prisma.session.findMany({
    where: { startTime: { gte: now }, visibility: 'public', seatsAvailable: { gt: 0 } },
    orderBy: { startTime: 'asc' },
    take: 4,
    include: { course: true, school: true },
  }).catch(() => []);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'EducationalOrganization',
    name: 'Uppsala Halkbana',
    url: `https://www.uppsalahalkbana.se/sv/riskutbildning/${params.city}`,
    description: `Riskutbildning Risk 1 och Risk 2 nära ${city.name}. Bil och motorcykel. Godkänd av Transportstyrelsen.`,
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'Norrlövsta 147',
      addressLocality: 'Alunda',
      postalCode: '747 91',
      addressCountry: 'SE',
    },
    areaServed: { '@type': 'City', name: city.name },
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: `Riskutbildning nära ${city.name}`,
      itemListElement: COURSES.map((c) => ({
        '@type': 'Course',
        name: c.title,
        description: c.description,
        provider: { '@type': 'Organization', name: 'Uppsala Halkbana' },
      })),
    },
  };

  const faqItems = FAQ(city.name).map((item) => ({
    '@type': 'Question',
    name: item.q,
    acceptedAnswer: { '@type': 'Answer', text: item.a },
  }));

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems,
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#fbf9f8]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <Navbar />

      {/* ── HERO ─────────────────────────────────────────────────────── */}
      <section className="bg-gray-950 relative overflow-hidden py-20 sm:py-28">
        <div className="absolute inset-0 bg-gradient-to-br from-gray-950 via-cyan-950/40 to-gray-900" />
        <div className="relative z-10 max-w-7xl mx-auto px-6 sm:px-10">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="w-4 h-4 text-swedish-blue" />
              <span className="text-swedish-blue text-xs font-bold uppercase tracking-widest">
                {city.distance} km från {city.name}
              </span>
            </div>
            <h1 className="font-headline text-4xl sm:text-5xl md:text-6xl font-extrabold text-white leading-tight mb-5">
              Riskutbildning<br />
              <span className="text-swedish-blue">nära {city.name}</span>
            </h1>
            <p className="text-gray-300 text-lg leading-relaxed mb-8 max-w-xl">
              Uppsala Halkbana erbjuder Risk 1 och Risk 2 för bil och motorcykel – bara {city.distance} km från {city.name}.
              Godkänd av Transportstyrelsen. Boka enkelt online.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/sv/courses" className="px-6 py-3.5 bg-swedish-yellow text-gray-900 rounded-xl font-bold text-sm hover:bg-yellow-300 transition-all shadow-lg hover:-translate-y-0.5">
                Boka riskutbildning →
              </Link>
              <Link href="/sv/courses" className="px-6 py-3.5 bg-white/10 text-white border border-white/20 rounded-xl font-bold text-sm hover:bg-white/20 transition-all">
                Se kurstillfällen
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── TRUST BAR ────────────────────────────────────────────────── */}
      <section className="bg-white border-b border-gray-100 py-5">
        <div className="max-w-7xl mx-auto px-6 sm:px-10">
          <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10 text-sm text-gray-600">
            {[
              { icon: <ShieldCheck className="w-4 h-4 text-swedish-blue" />, text: 'Godkänd av Transportstyrelsen' },
              { icon: <Star className="w-4 h-4 text-swedish-yellow" />, text: '4.9★ genomsnittligt betyg' },
              { icon: <Clock className="w-4 h-4 text-swedish-blue" />, text: 'Risk 1 + Risk 2 samma dag' },
              { icon: <MapPin className="w-4 h-4 text-swedish-blue" />, text: `${city.distance} km från ${city.name}` },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2 font-medium">
                {item.icon} {item.text}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── COURSES ──────────────────────────────────────────────────── */}
      <section className="py-20 bg-[#fbf9f8]">
        <div className="max-w-7xl mx-auto px-6 sm:px-10">
          <div className="mb-12">
            <p className="text-xs font-bold text-swedish-blue uppercase tracking-widest mb-2">Våra kurser</p>
            <h2 className="font-headline text-3xl sm:text-4xl font-extrabold text-gray-900">
              Riskutbildning för alla körkort
            </h2>
            <p className="text-gray-500 mt-3 max-w-xl">
              Vi erbjuder alla obligatoriska riskutbildningar för B-körkort (bil), A-körkort (motorcykel) och AM-körkort (moped) – populärt bland elever från {city.name}.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {COURSES.map((course) => (
              <div key={course.code} className={`rounded-2xl border p-6 bg-white flex flex-col ${course.color}`}>
                <div className="flex items-center justify-between mb-4">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${course.badgeColor}`}>
                    {course.icon} {course.badge}
                  </span>
                  <span className="text-xs font-bold text-gray-400">{course.code}</span>
                </div>
                <h3 className="font-headline font-extrabold text-gray-900 text-lg mb-2">{course.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed mb-4 flex-1">{course.description}</p>
                <ul className="space-y-1.5 mb-5">
                  {course.bullets.map((b) => (
                    <li key={b} className="flex items-center gap-2 text-xs text-gray-600">
                      <CheckCircle2 className="w-3.5 h-3.5 text-swedish-blue flex-shrink-0" /> {b}
                    </li>
                  ))}
                </ul>
                <div className="flex items-center justify-between mt-auto">
                  <span className="font-headline font-extrabold text-gray-900">{course.price}</span>
                  <Link href={course.href} className="inline-flex items-center gap-1 text-xs font-bold text-swedish-blue hover:underline">
                    Boka <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW TO GET HERE ──────────────────────────────────────────── */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6 sm:px-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-xs font-bold text-swedish-blue uppercase tracking-widest mb-2">Ta dig hit</p>
              <h2 className="font-headline text-3xl font-extrabold text-gray-900 mb-4">
                Från {city.name} till Alunda
              </h2>
              <p className="text-gray-600 leading-relaxed mb-6">{city.directions}</p>
              <div className="bg-gray-50 rounded-2xl p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-swedish-blue/10 rounded-lg flex items-center justify-center">
                    <MapPin className="w-4 h-4 text-swedish-blue" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Adress</p>
                    <p className="font-semibold text-gray-900 text-sm">Norrlövsta 147, 747 91 Alunda</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-swedish-blue/10 rounded-lg flex items-center justify-center">
                    <Clock className="w-4 h-4 text-swedish-blue" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Restid från {city.name}</p>
                    <p className="font-semibold text-gray-900 text-sm">Ca {city.driveMinutes} minuter med bil</p>
                  </div>
                </div>
              </div>
              <a
                href={`https://www.google.com/maps/dir/${encodeURIComponent(city.name)}/Norrl%C3%B6vsta+147,+747+91+Alunda`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 mt-5 px-5 py-3 bg-swedish-yellow text-gray-900 rounded-xl font-bold text-sm hover:bg-yellow-300 transition-all"
              >
                <MapPin className="w-4 h-4" /> Vägbeskrivning från {city.name}
              </a>
            </div>
            <div className="bg-gray-100 rounded-2xl overflow-hidden" style={{ height: 320 }}>
              <iframe
                title={`Karta från ${city.name} till Uppsala Halkbana`}
                src={`https://www.google.com/maps/embed/v1/directions?key=AIzaSyD-placeholder&origin=${encodeURIComponent(city.name)}&destination=Norrl%C3%B6vsta+147,+747+91+Alunda`}
                className="w-full h-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── UPCOMING SESSIONS ────────────────────────────────────────── */}
      {upcomingSessions.length > 0 && (
        <section className="py-20 bg-[#fbf9f8]">
          <div className="max-w-7xl mx-auto px-6 sm:px-10">
            <div className="flex items-end justify-between mb-8">
              <div>
                <p className="text-xs font-bold text-swedish-blue uppercase tracking-widest mb-2">Lediga platser</p>
                <h2 className="font-headline text-3xl font-extrabold text-gray-900">Kommande kurstillfällen</h2>
              </div>
              <Link href="/sv/courses" className="hidden md:inline-flex items-center gap-2 text-sm font-bold bg-swedish-yellow text-gray-900 px-4 py-2 rounded-xl hover:bg-yellow-300 transition-colors">
                Visa alla →
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {upcomingSessions.map((s) => (
                <Link key={s.id} href="/sv/courses" className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-md hover:-translate-y-0.5 transition-all group">
                  <p className="text-xs font-bold text-swedish-blue uppercase tracking-wide mb-1">{s.course?.behorighet}</p>
                  <p className="font-bold text-gray-900 text-sm mb-2 leading-snug">{s.course?.titleSv}</p>
                  <p className="text-xs text-gray-500 mb-1">
                    {new Date(s.startTime).toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' })}
                  </p>
                  <p className="text-xs text-gray-500 mb-3">
                    {new Date(s.startTime).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })} –{' '}
                    {new Date(s.endTime).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">{s.seatsAvailable} platser kvar</span>
                    <span className="text-xs font-bold text-swedish-blue group-hover:underline">Boka →</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── FAQ ──────────────────────────────────────────────────────── */}
      <section className="py-20 bg-white">
        <div className="max-w-3xl mx-auto px-6 sm:px-10">
          <p className="text-xs font-bold text-swedish-blue uppercase tracking-widest mb-2">Vanliga frågor</p>
          <h2 className="font-headline text-3xl font-extrabold text-gray-900 mb-10">
            Frågor om riskutbildning från {city.name}
          </h2>
          <div className="space-y-6">
            {FAQ(city.name).map((item, i) => (
              <div key={i} className="border-b border-gray-100 pb-6">
                <h3 className="font-bold text-gray-900 mb-2">{item.q}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── OTHER CITIES ─────────────────────────────────────────────── */}
      <section className="py-16 bg-[#fbf9f8]">
        <div className="max-w-7xl mx-auto px-6 sm:px-10">
          <p className="text-sm font-semibold text-gray-500 mb-4">Riskutbildning nära andra städer:</p>
          <div className="flex flex-wrap gap-2">
            {CITIES.filter((c) => c.slug !== params.city).map((c) => (
              <Link
                key={c.slug}
                href={`/sv/riskutbildning/${c.slug}`}
                className="px-3 py-1.5 bg-white border border-gray-200 rounded-full text-xs font-medium text-gray-600 hover:border-swedish-blue hover:text-swedish-blue transition-colors"
              >
                {c.name}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────── */}
      <section className="bg-swedish-blue py-20">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 text-center">
          <h2 className="font-headline text-3xl md:text-4xl font-extrabold text-white mb-4">
            Redo att boka från {city.name}?
          </h2>
          <p className="text-white/80 text-lg mb-8 max-w-lg mx-auto">
            Bara {city.distance} km och {city.driveMinutes} minuter bort. Boka din riskutbildning online idag.
          </p>
          <Link href="/sv/courses" className="inline-block px-8 py-4 bg-swedish-yellow text-gray-900 rounded-xl font-bold text-base hover:bg-yellow-300 transition-all shadow-lg hover:-translate-y-0.5">
            Boka riskutbildning →
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
