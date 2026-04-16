'use client';

import { useState, useEffect, useMemo } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { MapPin, Clock, Users, SlidersHorizontal } from 'lucide-react';
import type { Session } from '@/lib/types';
import clsx from 'clsx';

// ── Day label helper ─────────────────────────────────────────────────────────
function dayLabel(key: string) {
  return new Date(key + 'T12:00:00').toLocaleDateString('sv-SE', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

// ── Session row ───────────────────────────────────────────────────────────────
function SessionRow({ session, locale }: { session: Session; locale: string }) {
  const course = session.course!;
  const isCar = course.vehicle === 'Car';
  const isSoldOut = session.seatsAvailable === 0;
  const isLow = !isSoldOut && session.seatsAvailable <= 3;
  const start = new Date(session.startTime);
  const end = new Date(session.endTime);
  const timeStr = `${start.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Stockholm' })} – ${end.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Stockholm' })}`;
  const title = locale === 'sv' ? course.titleSv : course.titleEn;
  const typeLabel = course.type === 'Risk1' ? 'R1' : 'R2';
  const seatsUsed = session.seatLimit - session.seatsAvailable;
  const seatPct = Math.round((seatsUsed / session.seatLimit) * 100);

  return (
    <div className={clsx(
      'bg-white rounded-xl border overflow-hidden flex transition hover:shadow-md',
      isSoldOut ? 'border-gray-100 opacity-70' : 'border-gray-100 hover:border-gray-200',
    )}>
      {/* Left color strip */}
      <div className={clsx('w-1 shrink-0', isCar ? 'bg-swedish-blue' : 'bg-orange-400')} />

      <div className="flex-1 px-4 py-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">

          {/* ── Left: course info ── */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {/* Type badge */}
            <div className={clsx(
              'w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0',
              course.type === 'Risk1' ? 'bg-brand-100 text-swedish-blue' : 'bg-orange-100 text-orange-700',
            )}>
              {typeLabel}
            </div>

            <div className="min-w-0 flex-1">
              {/* Title + vehicle pill */}
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <p className="font-semibold text-gray-900 text-sm leading-tight">{title}</p>
                <span className={clsx(
                  'text-xs font-semibold px-2 py-0.5 rounded-full shrink-0',
                  isCar ? 'bg-cyan-50 text-cyan-700' : 'bg-orange-50 text-orange-700',
                )}>
                  {isCar ? '🚗 Bil' : '🏍️ MC'} · {course.behorighet}
                </span>
              </div>

              {/* Meta row */}
              <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3 shrink-0" />
                  {timeStr}
                </span>
                <span className="flex items-center gap-1 min-w-0">
                  <MapPin className="w-3 h-3 shrink-0" />
                  <span className="truncate">{course.location || session.school?.name}</span>
                </span>
                <span className={clsx(
                  'flex items-center gap-1 font-semibold',
                  isSoldOut ? 'text-red-500' : isLow ? 'text-orange-500' : 'text-gray-400',
                )}>
                  <Users className="w-3 h-3 shrink-0" />
                  {isSoldOut
                    ? 'Fullbokad'
                    : isLow
                      ? `${session.seatsAvailable} platser kvar`
                      : `${session.seatsAvailable}/${session.seatLimit} kvar`}
                </span>
              </div>

              {/* Seat bar */}
              <div className="mt-1.5 w-20 h-1 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={clsx('h-full rounded-full', isSoldOut ? 'bg-red-400' : isLow ? 'bg-orange-400' : 'bg-swedish-blue')}
                  style={{ width: `${seatPct}%` }}
                />
              </div>
            </div>
          </div>

          {/* ── Right: price + button ── */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <p className="font-bold text-gray-900 text-sm leading-tight">
                {course.price.toLocaleString('sv-SE')} kr
              </p>
              <p className="text-xs text-gray-400">per person</p>
            </div>
            {isSoldOut ? (
              <span className="px-3 py-1.5 text-xs font-semibold text-gray-400 bg-gray-100 rounded-lg whitespace-nowrap">
                Fullbokad
              </span>
            ) : (
              <Link
                href={`/${locale}/checkout?session=${session.id}`}
                className="px-4 py-1.5 text-xs font-bold bg-swedish-blue text-white rounded-lg hover:bg-swedish-dark transition whitespace-nowrap"
              >
                Boka
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function CoursesPreviewPage() {
  const locale = useLocale();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [vehicleFilter, setVehicleFilter] = useState<'all' | 'Car' | 'Motorcycle'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'Risk1' | 'Risk2'>('all');
  const [availableOnly, setAvailableOnly] = useState(false);

  useEffect(() => {
    fetch('/api/sessions')
      .then(r => r.json())
      .then(data => { setSessions(data.sessions || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => sessions.filter(s => {
    if (vehicleFilter !== 'all' && s.course?.vehicle !== vehicleFilter) return false;
    if (typeFilter !== 'all' && s.course?.type !== typeFilter) return false;
    if (availableOnly && s.seatsAvailable === 0) return false;
    return true;
  }), [sessions, vehicleFilter, typeFilter, availableOnly]);

  const grouped = useMemo(() => {
    const map: Record<string, Session[]> = {};
    filtered.forEach(s => {
      const d = new Date(s.startTime);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (!map[key]) map[key] = [];
      map[key].push(s);
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />

      {/* ── Header ── */}
      <section className="bg-gradient-to-r from-swedish-blue to-brand-700 text-white py-10">
        <div className="max-w-3xl mx-auto px-4">
          <p className="text-brand-200 text-xs font-bold uppercase tracking-widest mb-1">Uppsala Halkbana</p>
          <h1 className="text-3xl font-extrabold mb-1">Kommande kurstillfällen</h1>
          {!loading && (
            <p className="text-brand-100 text-sm">
              {filtered.length} {filtered.length === 1 ? 'kurstillfälle' : 'kurstillfällen'}
            </p>
          )}
        </div>
      </section>

      {/* ── Sticky filter bar ── */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-2.5 flex flex-wrap gap-2 items-center">
          <SlidersHorizontal className="w-3.5 h-3.5 text-gray-400 shrink-0" />

          {/* Vehicle */}
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            {(['all', 'Car', 'Motorcycle'] as const).map(v => (
              <button key={v} onClick={() => setVehicleFilter(v)}
                className={clsx('px-2.5 py-1 text-xs font-semibold rounded-md transition', vehicleFilter === v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800')}>
                {v === 'all' ? 'Alla fordon' : v === 'Car' ? '🚗 Bil' : '🏍️ MC'}
              </button>
            ))}
          </div>

          {/* Type */}
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            {(['all', 'Risk1', 'Risk2'] as const).map(v => (
              <button key={v} onClick={() => setTypeFilter(v)}
                className={clsx('px-2.5 py-1 text-xs font-semibold rounded-md transition', typeFilter === v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800')}>
                {v === 'all' ? 'Risk 1 & 2' : v === 'Risk1' ? 'Risk 1' : 'Risk 2'}
              </button>
            ))}
          </div>

          {/* Available only */}
          <button onClick={() => setAvailableOnly(p => !p)}
            className={clsx('px-2.5 py-1 text-xs font-semibold rounded-lg border transition', availableOnly ? 'bg-swedish-blue text-white border-swedish-blue' : 'text-gray-500 border-gray-200 hover:border-gray-300')}>
            Lediga platser
          </button>
        </div>
      </div>

      <main className="flex-1 py-6">
        <div className="max-w-3xl mx-auto px-4">

          {/* ── Loading ── */}
          {loading ? (
            <div className="text-center py-20">
              <div className="w-8 h-8 border-2 border-swedish-blue border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-gray-400 text-sm">Laddar kurser...</p>
            </div>

          /* ── Empty ── */
          ) : filtered.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-5xl mb-4">📅</div>
              <p className="text-gray-500 font-medium">Inga pass för vald period</p>
              <button onClick={() => { setVehicleFilter('all'); setTypeFilter('all'); setAvailableOnly(false); }}
                className="mt-4 text-sm text-swedish-blue hover:underline">
                Rensa filter
              </button>
            </div>

          /* ── Session list ── */
          ) : (
            <div className="space-y-6">
              {grouped.map(([dk, ds]) => (
                <div key={dk}>
                  {/* Day divider */}
                  <div className="flex items-center gap-3 mb-2.5">
                    <h2 className="text-sm font-semibold text-gray-600 capitalize whitespace-nowrap">{dayLabel(dk)}</h2>
                    <div className="flex-1 h-px bg-gray-200" />
                    <span className="text-xs text-gray-400 whitespace-nowrap">{ds.length} {ds.length === 1 ? 'pass' : 'pass'}</span>
                  </div>
                  {/* Rows */}
                  <div className="space-y-2">
                    {ds.map(s => <SessionRow key={s.id} session={s} locale={locale} />)}
                  </div>
                </div>
              ))}

            </div>
          )}
        </div>
      </main>

      <Footer />

      {/* ── Preview badge ── */}
      <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 bg-gray-900/85 backdrop-blur-md text-white text-[11px] font-semibold tracking-widest uppercase px-5 py-2.5 rounded-full flex items-center gap-2.5 shadow-lg">
        <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
        Förhandsgranskning – ny kurslista
      </div>
    </div>
  );
}
