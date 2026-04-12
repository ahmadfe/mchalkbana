'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Car, Bike, ArrowRight } from 'lucide-react';

const NAVY = '#173264';

const SERVICES = [
  {
    key: 'risk1-bil',
    nav: 'Risk 1 Bil',
    category: 'B-KÖRKORT',
    lines: ['RISK 1', 'BIL'],
    description:
      'Risk 1 är den obligatoriska riskutbildningens första steg för B-körkort. Träna på halkbana med erfarna instruktörer och lär dig hantera nödsituationer i trafiken.',
    vehicle: 'Car' as const,
    href: '/sv/courses',
  },
  {
    key: 'risk2-bil',
    nav: 'Risk 2 Bil',
    category: 'B-KÖRKORT',
    lines: ['RISK 2', 'BIL'],
    description:
      'Risk 2 fokuserar på alkohol, droger och trötthet i trafiken. Teori och gruppdiskussioner för djupare förståelse av de största trafikriskerna.',
    vehicle: 'Car' as const,
    href: '/sv/courses',
  },
  {
    key: 'risk1-mc',
    nav: 'Risk 1 MC',
    category: 'A-KÖRKORT',
    lines: ['RISK 1', 'MOTORCYKEL'],
    description:
      'Risk 1 för motorcykel ger dig rätt reflexer för kritiska situationer. Bromsteknik, undanmanöver och halkövning på specialanpassad bana.',
    vehicle: 'Motorcycle' as const,
    href: '/sv/courses',
  },
  {
    key: 'risk2-mc',
    nav: 'Risk 2 MC',
    category: 'A-KÖRKORT',
    lines: ['RISK 2', 'MOTORCYKEL'],
    description:
      'Risk 2 för motorcykel behandlar psykologiska och medicinska riskfaktorer. Godkänd av Transportstyrelsen och uppfyller alla krav för A-körkort.',
    vehicle: 'Motorcycle' as const,
    href: '/sv/courses',
  },
];

// SVG illustration compositions per service
function Illustration({ vehicle, index }: { vehicle: 'Car' | 'Motorcycle'; index: number }) {
  const Icon = vehicle === 'Car' ? Car : Bike;
  return (
    <div className="relative flex items-center justify-center w-full h-full pointer-events-none select-none">
      {/* Outermost ring */}
      <div className="absolute rounded-full border border-white/[0.04]"
        style={{ width: 560, height: 560 }} />
      {/* Middle ring */}
      <div className="absolute rounded-full border border-white/[0.08]"
        style={{ width: 390, height: 390 }} />
      {/* Inner ring */}
      <div className="absolute rounded-full border border-white/[0.14]"
        style={{ width: 250, height: 250 }} />
      {/* Core glow */}
      <div className="absolute rounded-full"
        style={{ width: 160, height: 160, background: 'radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 70%)' }} />
      {/* Main icon */}
      <Icon
        className="relative z-10 text-white"
        style={{ width: 140, height: 140, opacity: 0.18, strokeWidth: 0.7 }}
      />
      {/* Orbit dots */}
      {Array.from({ length: 8 }).map((_, d) => {
        const angle = (d / 8) * Math.PI * 2 + (index * Math.PI) / 6;
        const r = 195;
        return (
          <div
            key={d}
            className="absolute rounded-full bg-white"
            style={{
              width: d % 3 === 0 ? 5 : 3,
              height: d % 3 === 0 ? 5 : 3,
              opacity: d % 3 === 0 ? 0.25 : 0.12,
              left: `calc(50% + ${Math.cos(angle) * r}px - ${d % 3 === 0 ? 2.5 : 1.5}px)`,
              top: `calc(50% + ${Math.sin(angle) * r}px - ${d % 3 === 0 ? 2.5 : 1.5}px)`,
            }}
          />
        );
      })}
      {/* Cross-hair lines */}
      <div className="absolute" style={{ width: 1, height: 420, background: 'linear-gradient(to bottom, transparent, rgba(255,255,255,0.05) 50%, transparent)' }} />
      <div className="absolute" style={{ width: 420, height: 1, background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.05) 50%, transparent)' }} />
    </div>
  );
}

export default function FullPagePreview() {
  const [active, setActive] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<(HTMLElement | null)[]>([]);

  // Track active section via IntersectionObserver
  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = sectionRefs.current.indexOf(entry.target as HTMLElement);
            if (idx !== -1) setActive(idx);
          }
        });
      },
      { root, threshold: 0.55 },
    );

    sectionRefs.current.forEach((el) => { if (el) observer.observe(el); });
    return () => observer.disconnect();
  }, []);

  const scrollTo = (idx: number) => {
    sectionRefs.current[idx]?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div style={{ background: NAVY }} className="h-screen overflow-hidden relative">

      {/* ── TOP NAVBAR ──────────────────────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 sm:px-12 py-5">
        <Link href="/sv" className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Uppsala Halkbana" className="h-9 w-9 object-contain" />
          <span className="text-white/80 font-bold text-xs tracking-[0.25em] uppercase hidden sm:block">
            Uppsala Halkbana
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-8">
          {SERVICES.map((s, i) => (
            <button
              key={s.key}
              onClick={() => scrollTo(i)}
              className={`text-[11px] font-bold tracking-[0.2em] uppercase transition-colors duration-300 ${
                active === i ? 'text-white' : 'text-white/40 hover:text-white/70'
              }`}
            >
              {s.nav}
            </button>
          ))}
        </nav>

        <Link
          href="/sv/courses"
          className="text-[11px] font-bold tracking-[0.15em] uppercase text-white/70 border border-white/20 px-5 py-2.5 rounded-full hover:text-white hover:border-white/60 transition-all duration-300"
        >
          Boka nu
        </Link>
      </header>

      {/* ── RIGHT DOT NAV ───────────────────────────────────────────────── */}
      <nav className="fixed right-8 sm:right-10 top-1/2 -translate-y-1/2 z-40 hidden md:flex flex-col items-end gap-5">
        {SERVICES.map((s, i) => (
          <button
            key={s.key}
            onClick={() => scrollTo(i)}
            className="flex items-center gap-3 group"
          >
            <span
              className={`text-[10px] font-bold tracking-[0.2em] uppercase transition-all duration-300 ${
                active === i ? 'text-white' : 'text-white/25 group-hover:text-white/55'
              }`}
            >
              {s.nav}
            </span>
            <div
              className={`rounded-full border-2 transition-all duration-300 ${
                active === i
                  ? 'w-3.5 h-3.5 bg-white border-white'
                  : 'w-2 h-2 bg-transparent border-white/30 group-hover:border-white/60'
              }`}
            />
          </button>
        ))}
      </nav>

      {/* ── SCROLL CONTAINER ────────────────────────────────────────────── */}
      <div
        ref={scrollRef}
        className="h-screen overflow-y-scroll snap-y snap-mandatory"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}
      >

        {/* Service sections */}
        {SERVICES.map((service, i) => (
          <section
            key={service.key}
            ref={(el) => { sectionRefs.current[i] = el; }}
            className="snap-start h-screen relative flex"
            style={{ background: NAVY }}
          >
            {/* Illustration — right half */}
            <div className="absolute inset-0 flex items-center"
              style={{ paddingLeft: '40%' }}>
              <Illustration vehicle={service.vehicle} index={i} />
            </div>

            {/* Text — bottom left */}
            <div className="relative z-10 self-end px-10 sm:px-16 pb-16 sm:pb-20 max-w-md">
              {/* Category */}
              <p className="text-white/35 font-bold tracking-[0.35em] uppercase mb-4"
                style={{ fontSize: 10 }}>
                {service.category}
              </p>

              {/* Title */}
              <h2
                className="font-headline font-extrabold text-white uppercase leading-[0.88] tracking-wider mb-6"
                style={{ fontSize: 'clamp(2.8rem, 5.5vw, 5rem)' }}
              >
                {service.lines[0]}
                <br />
                {service.lines[1]}
              </h2>

              {/* Description */}
              <p className="text-white/55 text-sm leading-relaxed mb-8 max-w-[280px]">
                {service.description}
              </p>

              {/* CTA */}
              <Link
                href={service.href}
                className="inline-flex items-center gap-2 text-white/80 text-[13px] font-semibold hover:text-white transition-colors group"
              >
                <span className="border-b border-white/30 group-hover:border-white pb-0.5 transition-colors">
                  Läs mer
                </span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Section number watermark */}
            <div
              className="absolute bottom-4 left-14 font-headline font-extrabold text-white/[0.035] leading-none select-none"
              style={{ fontSize: 'clamp(5rem, 12vw, 10rem)' }}
            >
              0{i + 1}
            </div>
          </section>
        ))}

        {/* ── CTA / FINAL SECTION ─────────────────────────────────────── */}
        <section
          ref={(el) => { sectionRefs.current[SERVICES.length] = el; }}
          className="snap-start h-screen relative flex flex-col items-center justify-center"
          style={{ background: NAVY }}
        >
          {/* Decoration */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="absolute rounded-full border border-white/[0.03]" style={{ width: 600, height: 600 }} />
            <div className="absolute rounded-full border border-white/[0.06]" style={{ width: 400, height: 400 }} />
            <div className="absolute rounded-full border border-white/[0.1]" style={{ width: 220, height: 220 }} />
          </div>

          <div className="relative z-10 text-center px-6">
            <p className="text-white/35 font-bold tracking-[0.35em] uppercase mb-6" style={{ fontSize: 10 }}>
              Uppsala Halkbana
            </p>
            <h2
              className="font-headline font-extrabold text-white uppercase leading-[0.88] tracking-wider mb-8"
              style={{ fontSize: 'clamp(3rem, 7vw, 6.5rem)' }}
            >
              BOKA DIN
              <br />
              UTBILDNING
            </h2>
            <p className="text-white/50 text-base mb-12 max-w-sm mx-auto leading-relaxed">
              Säkra din plats idag – populära kurstillfällen fylls snabbt.
              <br />Godkänd av Transportstyrelsen.
            </p>
            <Link
              href="/sv/courses"
              className="inline-flex items-center gap-3 px-10 py-4 border border-white/30 text-white text-xs font-bold tracking-[0.2em] uppercase hover:bg-white hover:text-[#173264] transition-all duration-300"
            >
              SE ALLA KURSTILLFÄLLEN <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>

      </div>

      {/* ── PREVIEW BADGE ───────────────────────────────────────────────── */}
      <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 bg-white/[0.08] backdrop-blur-md text-white/80 text-[11px] font-medium tracking-widest uppercase px-5 py-2.5 rounded-full border border-white/10 flex items-center gap-2.5">
        <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
        Förhandsgranskning
      </div>
    </div>
  );
}
