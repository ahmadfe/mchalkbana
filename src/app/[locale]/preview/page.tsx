export const dynamic = 'force-dynamic';

import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { prisma } from '@/lib/db';
import { Car, Bike, ArrowRight, CheckCircle2, Clock, MapPin, ShieldCheck } from 'lucide-react';

// Course "cards" we always show, even if DB has no courses yet
const STATIC_SERVICES = [
  {
    key: 'risk1-bil',
    badge: 'B-körkort',
    title: 'Risk 1 – Bil',
    subtitle: 'Grundläggande riskutbildning för personbil',
    description:
      'Risk 1 är den obligatoriska riskutbildningens första steg för B-körkort. Du lär dig hantera nödsituationer, förstå hastighetens påverkan och tränar på vad som händer när bilen sladdar eller tappar väggrepp.',
    bullets: ['Teoridel om risker i trafiken', 'Praktisk halkövning på bana', 'Godkänd av Transportstyrelsen'],
    price: 'Fr. 2 500 kr',
    duration: 'Ca 4 timmar',
    href: '/sv/courses',
    color: 'from-swedish-blue/20 to-brand-200/30',
    bgClass: 'bg-gradient-to-br from-cyan-50 to-cyan-100',
    iconBg: 'bg-swedish-blue',
    vehicle: 'Car',
    type: 'Risk1',
  },
  {
    key: 'risk2-bil',
    badge: 'B-körkort',
    title: 'Risk 2 – Bil',
    subtitle: 'Avancerad riskutbildning för personbil',
    description:
      'Risk 2 fokuserar på alkohol, droger och trötthet i trafiken. Utbildningen kombinerar teori och gruppdiskussioner med praktiska moment för att ge dig en djupare förståelse för de största riskfaktorerna i trafiken.',
    bullets: ['Alkohol- och drogpåverkan i trafiken', 'Trötthetsrisk & mentala faktorer', 'Gruppövningar & diskussion'],
    price: 'Fr. 1 800 kr',
    duration: 'Ca 3 timmar',
    href: '/sv/courses',
    color: 'from-yellow-100 to-amber-100',
    bgClass: 'bg-gradient-to-br from-yellow-50 to-amber-100',
    iconBg: 'bg-swedish-yellow',
    vehicle: 'Car',
    type: 'Risk2',
  },
  {
    key: 'risk1-mc',
    badge: 'A-körkort',
    title: 'Risk 1 – Motorcykel',
    subtitle: 'Riskutbildning anpassad för motorcykelförare',
    description:
      'Risk 1 för motorcykel ger dig de kunskaper och reflexer du behöver för att hantera kritiska situationer på tvåhjuling. Vi tränar bromsteknik, undanmanövrar och hur du undviker de vanligaste motorcykelolyckorna.',
    bullets: ['Bromsteknik & undanmanöver', 'Halkövning med motorcykel', 'Körning på vår specialanpassade bana'],
    price: 'Fr. 2 800 kr',
    duration: 'Ca 5 timmar',
    href: '/sv/courses',
    color: 'from-gray-100 to-slate-200',
    bgClass: 'bg-gradient-to-br from-gray-100 to-slate-200',
    iconBg: 'bg-gray-800',
    vehicle: 'Motorcycle',
    type: 'Risk1',
  },
  {
    key: 'risk2-mc',
    badge: 'A-körkort',
    title: 'Risk 2 – Motorcykel',
    subtitle: 'Fördjupad riskutbildning för motorcykelförare',
    description:
      'Risk 2 för motorcykel tar upp de psykologiska och medicinska riskfaktorerna som varje motorcyklist måste känna till. Utbildningen är godkänd av Transportstyrelsen och uppfyller alla krav för A-körkort.',
    bullets: ['Alkohol & droger på motorcykel', 'Trötthets- och stresshantering', 'Interaktiv teorigenomgång'],
    price: 'Fr. 1 800 kr',
    duration: 'Ca 3 timmar',
    href: '/sv/courses',
    color: 'from-orange-50 to-orange-100',
    bgClass: 'bg-gradient-to-br from-orange-50 to-orange-100',
    iconBg: 'bg-orange-500',
    vehicle: 'Motorcycle',
    type: 'Risk2',
  },
];

export default async function PreviewPage({ params }: { params: { locale: string } }) {
  // Try to enrich with real DB data (price, title, etc.)
  let courses: { type: string; vehicle: string; price: number; titleSv: string; description: string }[] = [];
  try {
    courses = await prisma.course.findMany({
      select: { type: true, vehicle: true, price: true, titleSv: true, description: true },
    });
  } catch {
    // fallback to static data
  }

  const services = STATIC_SERVICES.map((s) => {
    const dbCourse = courses.find((c) => c.type === s.type && c.vehicle === s.vehicle);
    return {
      ...s,
      title: dbCourse?.titleSv ?? s.title,
      description: dbCourse?.description || s.description,
      price: dbCourse ? `Fr. ${dbCourse.price.toLocaleString('sv-SE')} kr` : s.price,
    };
  });

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar />

      {/* ── PAGE HERO ─────────────────────────────────────────────────────── */}
      <section className="border-b border-gray-100 bg-white">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 py-16 sm:py-20">
          <p className="text-xs font-bold text-swedish-blue uppercase tracking-widest mb-3">Uppsala Halkbana</p>
          <h1 className="font-headline text-4xl sm:text-5xl md:text-6xl font-extrabold text-gray-900 leading-[1.05] max-w-2xl">
            Våra utbildningar
          </h1>
          <p className="mt-5 text-gray-500 text-lg max-w-xl leading-relaxed">
            Lagstadgade riskutbildningar för bil och motorcykel. Godkända av Transportstyrelsen och
            utförda av certifierade instruktörer på vår moderna halkbana.
          </p>

          {/* Quick-nav anchors */}
          <nav className="mt-8 flex flex-wrap gap-3">
            {services.map((s) => (
              <a
                key={s.key}
                href={`#${s.key}`}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-gray-200 text-sm font-semibold text-gray-700 hover:border-swedish-blue hover:text-swedish-blue transition-colors"
              >
                {s.vehicle === 'Car' ? <Car className="w-3.5 h-3.5" /> : <Bike className="w-3.5 h-3.5" />}
                {s.title}
              </a>
            ))}
          </nav>
        </div>
      </section>

      {/* ── SERVICE ROWS ──────────────────────────────────────────────────── */}
      {services.map((service, i) => {
        const isEven = i % 2 === 0;
        return (
          <section
            key={service.key}
            id={service.key}
            className="border-b border-gray-100 scroll-mt-20"
          >
            <div className="max-w-7xl mx-auto">
              <div className={`flex flex-col ${isEven ? 'lg:flex-row' : 'lg:flex-row-reverse'}`}>

                {/* Image / Visual half */}
                <div className={`lg:w-1/2 min-h-[320px] sm:min-h-[400px] lg:min-h-[500px] relative overflow-hidden ${service.bgClass}`}>
                  {/* Decorative icon */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className={`${service.iconBg} rounded-3xl p-8 shadow-2xl opacity-90`}>
                      {service.vehicle === 'Car'
                        ? <Car className="w-24 h-24 text-white" strokeWidth={1.2} />
                        : <Bike className="w-24 h-24 text-white" strokeWidth={1.2} />
                      }
                    </div>
                  </div>
                  {/* Badge */}
                  <div className="absolute top-6 left-6">
                    <span className="inline-block bg-white/90 backdrop-blur-sm text-gray-800 text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded-full shadow-sm border border-white">
                      {service.badge}
                    </span>
                  </div>
                </div>

                {/* Text half */}
                <div className="lg:w-1/2 flex items-center px-8 sm:px-12 lg:px-16 py-14 lg:py-20">
                  <div className="max-w-lg w-full">
                    <p className="text-xs font-bold text-swedish-blue uppercase tracking-widest mb-3">
                      {service.badge}
                    </p>
                    <h2 className="font-headline text-3xl sm:text-4xl font-extrabold text-gray-900 leading-tight mb-3">
                      {service.title}
                    </h2>
                    <p className="text-base text-gray-500 font-medium mb-5">{service.subtitle}</p>
                    <p className="text-gray-600 leading-relaxed mb-8">{service.description}</p>

                    {/* Bullets */}
                    <ul className="space-y-3 mb-8">
                      {service.bullets.map((b) => (
                        <li key={b} className="flex items-start gap-3 text-sm text-gray-700">
                          <CheckCircle2 className="w-4 h-4 text-swedish-blue mt-0.5 flex-shrink-0" />
                          {b}
                        </li>
                      ))}
                    </ul>

                    {/* Meta row */}
                    <div className="flex items-center gap-6 text-sm text-gray-500 mb-8 flex-wrap">
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-4 h-4" /> {service.duration}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <MapPin className="w-4 h-4" /> Alunda, Uppsala
                      </span>
                      <span className="flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4" /> Transportstyrelsen
                      </span>
                    </div>

                    {/* Price + CTA */}
                    <div className="flex items-center gap-5 flex-wrap">
                      <span className="font-headline text-2xl font-extrabold text-gray-900">{service.price}</span>
                      <Link
                        href={service.href}
                        className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 text-white text-sm font-bold rounded-xl hover:bg-gray-700 transition-all hover:-translate-y-0.5 shadow-md"
                      >
                        Boka nu <ArrowRight className="w-4 h-4" />
                      </Link>
                      <Link
                        href={service.href}
                        className="text-sm font-semibold text-swedish-blue hover:underline"
                      >
                        Läs mer →
                      </Link>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </section>
        );
      })}

      {/* ── BOTTOM CTA ────────────────────────────────────────────────────── */}
      <section className="py-24 bg-gray-950">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 text-center">
          <p className="text-xs font-bold text-swedish-blue uppercase tracking-widest mb-4">Kom igång</p>
          <h2 className="font-headline text-3xl sm:text-4xl md:text-5xl font-extrabold text-white leading-tight mb-5">
            Redo att boka din utbildning?
          </h2>
          <p className="text-gray-400 text-lg max-w-xl mx-auto mb-10">
            Säkra din plats idag – populära kurstillfällen fylls snabbt.
          </p>
          <Link
            href="/sv/courses"
            className="inline-flex items-center gap-2 px-8 py-4 bg-swedish-yellow text-gray-900 rounded-xl font-bold text-base hover:bg-yellow-300 transition-all shadow-lg hover:-translate-y-0.5"
          >
            Se alla kurstillfällen <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      <Footer />

      {/* Preview banner */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm font-medium px-5 py-2.5 rounded-full shadow-xl flex items-center gap-3">
        <span className="w-2 h-2 rounded-full bg-swedish-yellow animate-pulse" />
        Förhandsgranskning – denna sida är inte publicerad ännu
      </div>
    </div>
  );
}
