'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { Plus, Search } from 'lucide-react';
import clsx from 'clsx';
import KindBadge from './KindBadge';

/*
 * Listorna bredvid en kurs eller elev på surfplatta (liggande) och dator – som Mail-appen.
 * Senaste svaret sparas i modulen så att listan syns direkt när man byter kurs, och uppdateras i bakgrunden.
 */

const tz = { timeZone: 'Europe/Stockholm' } as const;
const hm = (iso: string) => new Date(iso).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', ...tz });

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="flex p-1 rounded-xl bg-white/5">
      {options.map(([v, label]) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={clsx('flex-1 h-8 rounded-lg text-sm font-semibold transition', value === v ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white')}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function Header({ title, newHref }: { title: string; newHref: string }) {
  const locale = useLocale();
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="font-headline text-xl font-extrabold">{title}</h2>
      <Link href={`/${locale}${newHref}`} aria-label={`Ny ${title === 'Kurser' ? 'kurs' : 'elev'}`} className="w-9 h-9 rounded-full bg-white text-black flex items-center justify-center hover:bg-white/90">
        <Plus className="w-4 h-4" />
      </Link>
    </div>
  );
}

/** Rullar fram den valda raden första gången listan visas. */
function useScrollToActive(ready: boolean) {
  const ref = useRef<HTMLAnchorElement>(null);
  const done = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (!ready || done.current || !el) return;
    done.current = true;
    // Rulla bara listan – scrollIntoView skulle också rulla själva sidan
    const list = el.closest('.overflow-y-auto') as HTMLElement | null;
    if (list) list.scrollTop = el.offsetTop - list.offsetTop - list.clientHeight / 2 + el.clientHeight / 2;
  }, [ready]);
  return ref;
}

const Spinner = () => <div className="py-16 flex justify-center"><div className="w-5 h-5 border-2 border-white/50 border-t-transparent rounded-full animate-spin" /></div>;

// ── Kurser ────────────────────────────────────────────────────────────

interface KursRow { id: number; startTime: string; endTime: string; title: string; courseType: string; seatLimit: number; booked: number; status: string }
type KursView = 'upcoming' | 'past';

const kursCache: Partial<Record<KursView, KursRow[]>> = {};
let lastKursView: KursView = 'upcoming';

export function KurserSideList({ activeId }: { activeId: number }) {
  const locale = useLocale();
  const [view, setView] = useState<KursView>(lastKursView);
  const [rows, setRows] = useState<KursRow[] | null>(kursCache[view] ?? null);

  useEffect(() => {
    lastKursView = view;
    setRows(kursCache[view] ?? null);
    let alive = true;
    fetch(`/api/admin/kurser?view=${view}`).then(r => r.json()).then(d => {
      kursCache[view] = d.kurser ?? [];
      if (alive) setRows(kursCache[view]!);
    });
    return () => { alive = false; };
  }, [view]);

  const activeRef = useScrollToActive(!!rows);
  let lastMonth = '';

  return (
    <>
      <div className="px-4 pt-6 pb-3 border-b border-white/5">
        <Header title="Kurser" newHref="/admin/kurser/ny" />
        <Segmented value={view} onChange={setView} options={[['upcoming', 'Kommande'], ['past', 'Genomförda']]} />
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {rows === null ? <Spinner /> : rows.length === 0 ? (
          <p className="text-sm text-white/40 text-center py-10">Inga kurser</p>
        ) : rows.map(k => {
          const d = new Date(k.startTime);
          const month = d.toLocaleDateString('sv-SE', { month: 'long', year: 'numeric', ...tz });
          const showMonth = month !== lastMonth;
          lastMonth = month;
          const active = k.id === activeId;
          return (
            <div key={k.id}>
              {showMonth && <p className="px-3 pt-3 pb-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-white/35">{month}</p>}
              <Link
                ref={active ? activeRef : undefined}
                href={`/${locale}/admin/kurser/${k.id}`}
                className={clsx('flex items-center gap-3 px-3 py-2.5 rounded-xl transition', active ? 'bg-white/10' : 'hover:bg-white/5', k.status === 'canceled' && 'opacity-50')}
              >
                <div className="w-10 shrink-0 text-center">
                  <p className="text-[11px] uppercase text-white/45 leading-none">{d.toLocaleDateString('sv-SE', { weekday: 'short', ...tz }).replace('.', '')}</p>
                  <p className="font-headline text-lg font-extrabold leading-tight">{d.toLocaleDateString('sv-SE', { day: 'numeric', ...tz })}</p>
                </div>
                <div className="min-w-0 flex-1">
                  <p className={clsx('text-sm font-semibold truncate', k.status === 'canceled' && 'line-through')}>{k.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <KindBadge type={k.courseType} />
                    <span className="text-xs text-white/50">{hm(k.startTime)}–{hm(k.endTime)}</span>
                  </div>
                </div>
                <span className={clsx('text-xs font-bold shrink-0', k.booked >= k.seatLimit ? 'text-emerald-300' : 'text-white/50')}>{k.booked}/{k.seatLimit}</span>
              </Link>
            </div>
          );
        })}
      </div>
    </>
  );
}

// ── Elever ────────────────────────────────────────────────────────────

interface ElevRow { id: number; name: string; personnummer: string | null; phone: string | null; risk1DoneAt: string | null; risk2DoneAt: string | null }
type ElevStatus = 'active' | 'archived';

const elevCache = new Map<string, ElevRow[]>();
let lastElev: { status: ElevStatus; q: string } = { status: 'active', q: '' };

export function EleverSideList({ activeId }: { activeId: number }) {
  const locale = useLocale();
  const [status, setStatus] = useState<ElevStatus>(lastElev.status);
  const [q, setQ] = useState(lastElev.q);
  const key = `${status}|${q}`;
  const [rows, setRows] = useState<ElevRow[] | null>(elevCache.get(key) ?? null);

  useEffect(() => {
    lastElev = { status, q };
    if (elevCache.has(key)) setRows(elevCache.get(key)!);
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/admin/students?${new URLSearchParams({ status, q })}`, { signal: ctrl.signal })
        .then(r => r.json())
        .then(d => { elevCache.set(key, d.students ?? []); setRows(d.students ?? []); })
        .catch(() => {});
    }, q ? 250 : 0);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [status, q, key]);

  const activeRef = useScrollToActive(!!rows);

  return (
    <>
      <div className="px-4 pt-6 pb-3 border-b border-white/5 space-y-3">
        <Header title="Elever" newHref="/admin/elever/ny" />
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Sök elev"
            className="w-full h-10 pl-9 pr-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-white/30 focus:outline-none focus:border-white/40"
          />
        </div>
        <Segmented value={status} onChange={setStatus} options={[['active', 'Aktiva'], ['archived', 'Arkiverade']]} />
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {rows === null ? <Spinner /> : rows.length === 0 ? (
          <p className="text-sm text-white/40 text-center py-10">{q ? 'Ingen elev matchar' : 'Inga elever'}</p>
        ) : rows.map(s => {
          const active = s.id === activeId;
          return (
            <Link
              key={s.id}
              ref={active ? activeRef : undefined}
              href={`/${locale}/admin/elever/${s.id}`}
              className={clsx('flex items-center gap-3 px-3 py-2.5 rounded-xl transition', active ? 'bg-white/10' : 'hover:bg-white/5')}
            >
              <span className="w-9 h-9 rounded-full bg-white/10 text-xs font-bold flex items-center justify-center shrink-0">
                {(s.name || '?').split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase()).join('')}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate">{s.name || '(namn saknas)'}</p>
                <p className="text-xs text-white/45 truncate">{s.personnummer || s.phone || '–'}</p>
              </div>
              {(s.risk1DoneAt || s.risk2DoneAt) && (
                <span className="text-[11px] font-bold text-emerald-300 shrink-0">{[s.risk1DoneAt && 'R1', s.risk2DoneAt && 'R2'].filter(Boolean).join(' ')}</span>
              )}
            </Link>
          );
        })}
      </div>
    </>
  );
}
