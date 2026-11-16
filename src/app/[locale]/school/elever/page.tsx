'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { Search, Users } from 'lucide-react';
import clsx from 'clsx';
import { SchoolPage, useSchool } from '@/components/school/SchoolShell';
import { hm, KIND, tz, type SchoolBooking } from '@/components/school/shared';
import { Badge, Input } from '@/components/admin/ui';
import { courseKind } from '@/lib/courseKind';

type Filter = 'all' | 'coming' | 'done';

/** Kommande / pågår / genomförd – skolan ser inte godkänd/ej godkänd. */
function stateOf(b: SchoolBooking, now: Date) {
  const start = new Date(b.session.startTime);
  const end = new Date(b.session.endTime);
  if (start > now) return { key: 'coming' as const, label: 'Kommande', tone: 'blue' as const };
  if (end > now) return { key: 'done' as const, label: 'Pågår', tone: 'amber' as const };
  return { key: 'done' as const, label: 'Genomförd', tone: 'neutral' as const };
}

export default function SchoolStudentsPage() {
  const locale = useLocale();
  const { bookings } = useSchool();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const now = new Date();

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase().replace(/[\s-]/g, '');
    return [...bookings]
      .filter(b => filter === 'all' || stateOf(b, now).key === filter)
      .filter(b => !needle || [b.guestName, b.personnummer, b.guestPhone, b.guestEmail, b.session.course?.titleSv]
        .some(v => (v ?? '').toLowerCase().replace(/[\s-]/g, '').includes(needle)))
      // Kommande först (närmast först), sedan genomförda (senaste först)
      .sort((a, b) => {
        const sa = new Date(a.session.startTime).getTime(), sb = new Date(b.session.startTime).getTime();
        const ca = sa > now.getTime(), cb = sb > now.getTime();
        if (ca !== cb) return ca ? -1 : 1;
        return ca ? sa - sb : sb - sa;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookings, q, filter]);

  const counts = {
    all: bookings.length,
    coming: bookings.filter(b => stateOf(b, now).key === 'coming').length,
    done: bookings.filter(b => stateOf(b, now).key === 'done').length,
  };
  const title = (b: SchoolBooking) => (locale === 'sv' ? b.session.course?.titleSv : b.session.course?.titleEn) ?? '';
  const when = (b: SchoolBooking) => {
    const d = new Date(b.session.startTime);
    return `${d.toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined, ...tz })} ${hm(d)}`;
  };

  return (
    <SchoolPage title="Elever" subtitle={`${bookings.length} elever bokade av er skola`}>
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-white/40 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Sök namn, personnummer, telefon…" className="pl-11" aria-label="Sök elev" />
        </div>
        <div className="flex p-1 rounded-2xl bg-[#1c1c1f] shrink-0">
          {([['all', 'Alla'], ['coming', 'Kommande'], ['done', 'Genomförda']] as const).map(([v, label]) => (
            <button
              key={v}
              onClick={() => setFilter(v)}
              className={clsx('h-10 px-3 sm:px-4 rounded-xl text-sm font-semibold transition whitespace-nowrap', filter === v ? 'bg-white text-black' : 'text-white/60 hover:text-white')}
            >
              {label} <span className={filter === v ? 'text-black/50' : 'text-white/35'}>{counts[v]}</span>
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-16 px-6 rounded-3xl bg-[#1c1c1f]">
          <Users className="w-10 h-10 mx-auto mb-3 text-white/25" strokeWidth={1.5} />
          <p className="font-semibold">{bookings.length === 0 ? 'Inga elever än' : 'Inga elever matchar'}</p>
          <p className="text-sm text-white/50 mt-1">{bookings.length === 0 ? 'Lägg till elever under Pass.' : 'Prova en annan sökning eller ett annat filter.'}</p>
        </div>
      ) : (
        <>
          {/* Dator/surfplatta: tabell */}
          <div className="hidden md:block rounded-3xl bg-[#1c1c1f] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-bold uppercase tracking-[0.1em] text-white/45 border-b border-white/5">
                  <th className="px-5 py-3.5 font-bold">Elev</th>
                  <th className="px-3 py-3.5 font-bold">Personnummer</th>
                  <th className="px-3 py-3.5 font-bold">Kurs</th>
                  <th className="px-3 py-3.5 font-bold">Datum</th>
                  <th className="px-5 py-3.5 font-bold text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {rows.map(b => {
                  const st = stateOf(b, now);
                  const kind = KIND[courseKind(b.session.course?.type ?? '')];
                  return (
                    <tr key={b.id} className="hover:bg-white/[0.03]">
                      <td className="px-5 py-3.5">
                        <p className="font-semibold">{b.guestName || '–'}</p>
                        {(b.guestPhone || b.guestEmail?.includes('@')) && (
                          <p className="text-xs text-white/45 mt-0.5 truncate max-w-[16rem]">{[b.guestPhone, b.guestEmail?.includes('@') ? b.guestEmail : null].filter(Boolean).join(' · ')}</p>
                        )}
                      </td>
                      <td className="px-3 py-3.5 font-mono text-white/70 whitespace-nowrap">{b.personnummer || '–'}</td>
                      <td className="px-3 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className={clsx('text-[11px] font-bold px-1.5 py-0.5 rounded-md shrink-0', kind.cls)}>{kind.label}</span>
                          <span className="truncate max-w-[14rem]">{title(b)}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3.5 whitespace-nowrap">
                        {st.key === 'coming'
                          ? <Link href={`/${locale}/school/pass?id=${b.session.id}`} className="hover:underline">{when(b)}</Link>
                          : <span className="text-white/70">{when(b)}</span>}
                      </td>
                      <td className="px-5 py-3.5 text-right"><Badge tone={st.tone}>{st.label}</Badge></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobil: kort */}
          <ul className="md:hidden space-y-2">
            {rows.map(b => {
              const st = stateOf(b, now);
              const kind = KIND[courseKind(b.session.course?.type ?? '')];
              return (
                <li key={b.id} className="rounded-2xl bg-[#1c1c1f] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold">{b.guestName || '–'}</p>
                      <p className="text-sm font-mono text-white/60">{b.personnummer || '–'}</p>
                    </div>
                    <Badge tone={st.tone}>{st.label}</Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-2 text-sm">
                    <span className={clsx('text-[11px] font-bold px-1.5 py-0.5 rounded-md shrink-0', kind.cls)}>{kind.label}</span>
                    <span className="truncate text-white/80">{title(b)}</span>
                  </div>
                  <p className="text-sm text-white/50 mt-1">{when(b)}</p>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </SchoolPage>
  );
}
