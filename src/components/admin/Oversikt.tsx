'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { AlertCircle, CheckCircle2, ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import KindBadge from './KindBadge';

type Period = 'today' | 'week' | 'month' | 'year';
interface Course { id: number; title: string; type: string; startTime: string; endTime: string; seatLimit: number; instructors: string[]; booked: number; checkedIn?: number }
interface Data {
  cards: { courses: number; bookings: number; booked: number; seats: number };
  today: Course[];
  next7: Course[];
  todo: { key: string; label: string; count: number; href: string }[];
  schools: { name: string; students: number }[];
  income: null | { period: { swish: number; schools: number }; months: { month: string; swish: number; schools: number }[] };
}

const PERIODS: [Period, string][] = [['today', 'Idag'], ['week', 'Vecka'], ['month', 'Månad'], ['year', 'År']];
const PERIOD_TEXT: Record<Period, string> = { today: 'i dag', week: 'denna vecka', month: 'denna månad', year: 'i år' };

// Serierna i intäktsdiagrammet – validerade mot den mörka ytan (dataviz-paletten, plats 1 och 2)
const SWISH = '#3987e5';
const SCHOOLS = '#d95926';

const tz = { timeZone: 'Europe/Stockholm' } as const;
const hm = (iso: string) => new Date(iso).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', ...tz });
const kr = (n: number) => `${Math.round(n).toLocaleString('sv-SE')} kr`;
const short = (n: number) => (Math.abs(n) >= 1000 ? `${(n / 1000).toLocaleString('sv-SE', { maximumFractionDigits: 1 })}k` : String(Math.round(n)));

/** Översikt: dagens kurser, att göra, kommande vecka – och intäkter för ägaren. */
export default function Oversikt() {
  const locale = useLocale();
  const [period, setPeriod] = useState<Period>('month');
  const [data, setData] = useState<Data | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/admin/oversikt?period=${period}`).then(r => r.json()).then(d => { if (alive) setData(d); });
    return () => { alive = false; };
  }, [period]);

  const href = (p: string) => `/${locale}${p}`;
  const fill = data && data.cards.seats > 0 ? Math.round((data.cards.booked / data.cards.seats) * 100) : null;
  const todo = data?.todo.filter(t => t.count > 0) ?? [];

  return (
    <div className="space-y-5">
      <div className="flex p-1 rounded-2xl bg-[#1c1c1f] sm:max-w-md">
        {PERIODS.map(([p, label]) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={clsx('flex-1 h-10 rounded-xl text-sm font-semibold transition', period === p ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white')}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Siffror för vald period */}
      <div className={clsx('grid grid-cols-2 gap-3', data?.income ? 'lg:grid-cols-4' : 'lg:grid-cols-3')}>
        <Stat label="Kurser" value={data ? String(data.cards.courses) : '–'} sub={PERIOD_TEXT[period]} />
        <Stat label="Nya bokningar" value={data ? String(data.cards.bookings) : '–'} sub={PERIOD_TEXT[period]} />
        <Stat label="Beläggning" value={fill === null ? '–' : `${fill} %`} sub={data ? `${data.cards.booked} av ${data.cards.seats} platser` : ''} />
        {data?.income && (
          <Stat
            label="Intäkter"
            value={kr(data.income.period.swish + data.income.period.schools)}
            sub={`Swish ${kr(data.income.period.swish)} · skolor ${kr(data.income.period.schools)}`}
          />
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-4 items-start">
        <div className="space-y-4">
          <Panel title="Idag">
            {!data ? <Loading /> : data.today.length === 0 ? (
              <p className="text-sm text-white/45 py-2">Inga kurser i dag.</p>
            ) : (
              <div className="space-y-2">
                {data.today.map(c => {
                  const done = c.booked > 0 && c.checkedIn === c.booked;
                  return (
                    <Link key={c.id} href={href(`/admin/kurser/${c.id}`)} className="block rounded-2xl bg-white/5 hover:bg-white/10 px-4 py-3 transition">
                      <div className="flex items-center gap-2">
                        <KindBadge type={c.type} />
                        <span className="font-semibold truncate flex-1">{c.title}</span>
                        <span className="text-sm text-white/60 shrink-0">{hm(c.startTime)}–{hm(c.endTime)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3 mt-2 text-sm">
                        <span className={clsx('truncate', c.instructors.length ? 'text-white/50' : 'text-amber-300')}>
                          {c.instructors.length ? c.instructors.join(', ') : 'Ingen lärare tilldelad'}
                        </span>
                        <span className={clsx('font-semibold shrink-0', done ? 'text-emerald-300' : 'text-white/80')}>
                          {c.checkedIn} av {c.booked} incheckade
                        </span>
                      </div>
                      <Bar value={c.checkedIn ?? 0} max={Math.max(1, c.booked)} />
                    </Link>
                  );
                })}
              </div>
            )}
          </Panel>

          <Panel title="Kommande 7 dagar" action={<Link href={href('/admin/kurser')} className="text-sm text-white/50 hover:text-white">Alla kurser</Link>}>
            {!data ? <Loading /> : data.next7.length === 0 ? (
              <p className="text-sm text-white/45 py-2">Inga kurser de närmaste sju dagarna.</p>
            ) : (
              <div className="divide-y divide-white/5">
                {data.next7.map(c => (
                  <Link key={c.id} href={href(`/admin/kurser/${c.id}`)} className="flex items-center gap-3 py-2.5 hover:bg-white/[0.03] -mx-2 px-2 rounded-xl">
                    <div className="w-11 shrink-0 text-center">
                      <p className="text-[11px] uppercase text-white/45 leading-none">{new Date(c.startTime).toLocaleDateString('sv-SE', { weekday: 'short', ...tz }).replace('.', '')}</p>
                      <p className="font-headline text-lg font-extrabold leading-tight">{new Date(c.startTime).toLocaleDateString('sv-SE', { day: 'numeric', ...tz })}</p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate">{c.title}</p>
                      <p className="text-xs text-white/50">{hm(c.startTime)}–{hm(c.endTime)}{c.instructors.length ? ` · ${c.instructors.join(', ')}` : ' · ingen lärare'}</p>
                      <Bar value={c.booked} max={c.seatLimit} />
                    </div>
                    <span className={clsx('text-sm font-bold shrink-0', c.booked >= c.seatLimit ? 'text-emerald-300' : 'text-white/70')}>{c.booked}/{c.seatLimit}</span>
                  </Link>
                ))}
              </div>
            )}
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title="Att göra">
            {!data ? <Loading /> : todo.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-emerald-300 py-2"><CheckCircle2 className="w-4 h-4" /> Inget som väntar just nu.</p>
            ) : (
              <div className="space-y-1">
                {todo.map(t => (
                  <Link key={t.key} href={href(t.href)} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-white/5 -mx-1">
                    <AlertCircle className="w-4 h-4 text-amber-300 shrink-0" />
                    <span className="flex-1 text-sm">{t.label}</span>
                    <span className="min-w-7 h-7 px-2 rounded-full bg-amber-500/15 text-amber-200 text-sm font-bold flex items-center justify-center">{t.count}</span>
                    <ChevronRight className="w-4 h-4 text-white/30" />
                  </Link>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Trafikskolor denna månad">
            {!data ? <Loading /> : data.schools.length === 0 ? (
              <p className="text-sm text-white/45 py-2">Inga skolelever på kurser den här månaden.</p>
            ) : (
              <div className="space-y-3">
                {data.schools.map(s => (
                  <div key={s.name}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="truncate">{s.name}</span>
                      <span className="font-semibold shrink-0 ml-3">{s.students} {s.students === 1 ? 'elev' : 'elever'}</span>
                    </div>
                    <Bar value={s.students} max={data.schools[0].students} />
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </div>

      {data?.income && <IncomeChart months={data.income.months} />}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-2xl bg-[#1c1c1f] p-4 min-w-0">
      <p className="text-sm text-white/60">{label}</p>
      <p className="font-headline text-2xl font-extrabold mt-1 truncate">{value}</p>
      <p className="text-xs text-white/40 mt-0.5 truncate">{sub}</p>
    </div>
  );
}

function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl bg-[#1c1c1f] p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-bold uppercase tracking-[0.12em] text-white/50">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Bar({ value, max }: { value: number; max: number }) {
  return (
    <div className="h-1.5 rounded-full bg-white/10 overflow-hidden mt-2">
      <div className="h-full rounded-full bg-sky-400" style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
    </div>
  );
}

const Loading = () => <div className="py-6 flex justify-center"><div className="w-5 h-5 border-2 border-white/40 border-t-transparent rounded-full animate-spin" /></div>;

/** Intäkter per månad, Swish och skolfakturor staplade. Bara för ägaren. */
function IncomeChart({ months }: { months: { month: string; swish: number; schools: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const label = (m: string, style: 'short' | 'long') => {
    const [y, mo] = m.split('-').map(Number);
    return new Date(Date.UTC(y, mo - 1, 15)).toLocaleDateString('sv-SE', style === 'short' ? { month: 'short' } : { month: 'long', year: 'numeric' }).replace('.', '');
  };
  // Kreditfakturor kan ge minus en månad – staplarna börjar alltid på noll
  const max = Math.max(1, ...months.map(m => Math.max(0, m.swish) + Math.max(0, m.schools)));
  const step = [1000, 2000, 5000, 10000, 20000, 25000, 50000, 100000, 200000].find(s => max / s <= 4) ?? 500000;
  const top = Math.ceil(max / step) * step;
  const ticks = Array.from({ length: top / step + 1 }, (_, i) => i * step);
  const H = 180;
  const total = months.reduce((s, m) => s + m.swish + m.schools, 0);
  const h = hover !== null ? months[hover] : null;

  return (
    <section className="rounded-3xl bg-[#1c1c1f] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-[0.12em] text-white/50">Intäkter per månad</h2>
          <p className="text-sm text-white/60 mt-1">Senaste 12 månaderna · {kr(total)} inkl. moms</p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="flex items-center gap-1.5 text-white/80"><span className="w-3 h-3 rounded-sm" style={{ background: SWISH }} />Swish</span>
          <span className="flex items-center gap-1.5 text-white/80"><span className="w-3 h-3 rounded-sm" style={{ background: SCHOOLS }} />Skolor (fakturor)</span>
          <button onClick={() => setTable(!table)} className="text-white/50 hover:text-white underline underline-offset-2">{table ? 'Visa diagram' : 'Visa tabell'}</button>
        </div>
      </div>

      {table ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[360px]">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-white/40 border-b border-white/10">
                <th className="py-2 pr-3">Månad</th><th className="py-2 pr-3 text-right">Swish</th><th className="py-2 pr-3 text-right">Skolor</th><th className="py-2 text-right">Totalt</th>
              </tr>
            </thead>
            <tbody>
              {[...months].reverse().map(m => (
                <tr key={m.month} className="border-b border-white/5">
                  <td className="py-2 pr-3 capitalize">{label(m.month, 'long')}</td>
                  <td className="py-2 pr-3 text-right">{kr(m.swish)}</td>
                  <td className="py-2 pr-3 text-right">{kr(m.schools)}</td>
                  <td className="py-2 text-right font-semibold">{kr(m.swish + m.schools)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative">
          {/* Tooltip för stapeln under pekaren */}
          {h && hover !== null && (
            <div
              className="absolute z-10 -translate-x-1/2 rounded-xl bg-[#2a2a2e] border border-white/10 px-3 py-2 text-xs shadow-xl pointer-events-none whitespace-nowrap"
              style={{ left: `calc(2.75rem + (100% - 2.75rem) * ${(hover + 0.5) / months.length})`, top: 0 }}
            >
              <p className="font-semibold capitalize mb-1">{label(h.month, 'long')}</p>
              <p className="flex items-center gap-1.5 text-white/80"><span className="w-2 h-2 rounded-sm" style={{ background: SWISH }} />Swish {kr(h.swish)}</p>
              <p className="flex items-center gap-1.5 text-white/80"><span className="w-2 h-2 rounded-sm" style={{ background: SCHOOLS }} />Skolor {kr(h.schools)}</p>
              <p className="font-semibold mt-1">Totalt {kr(h.swish + h.schools)}</p>
            </div>
          )}
          <div className="flex" style={{ height: H + 24 }}>
            {/* Y-axel */}
            <div className="relative w-11 shrink-0" style={{ height: H }}>
              {ticks.map(t => (
                <span key={t} className="absolute right-2 text-[11px] text-white/40" style={{ bottom: `${(t / top) * H}px`, transform: 'translateY(50%)' }}>{short(t)}</span>
              ))}
            </div>
            <div className="relative flex-1" onMouseLeave={() => setHover(null)}>
              {ticks.map(t => (
                <div key={t} className="absolute inset-x-0 border-t border-white/[0.06]" style={{ bottom: `${(t / top) * H + 24}px` }} />
              ))}
              <div className="absolute inset-x-0 top-0 flex items-end" style={{ height: H }}>
                {months.map((m, i) => {
                  const sw = Math.max(0, m.swish);
                  const sc = Math.max(0, m.schools);
                  const both = sw > 0 && sc > 0;
                  return (
                    <button
                      key={m.month}
                      type="button"
                      aria-label={`${label(m.month, 'long')}: Swish ${kr(m.swish)}, skolor ${kr(m.schools)}`}
                      onMouseEnter={() => setHover(i)}
                      onFocus={() => setHover(i)}
                      onClick={() => setHover(hover === i ? null : i)}
                      className="flex-1 min-w-0 h-full flex flex-col justify-end items-center focus:outline-none"
                    >
                      {/* Skolor ovanpå Swish, 2 px mellanrum, rundat bara överst */}
                      <div className={clsx('w-[64%] sm:w-[52%] max-w-10 flex flex-col', hover !== null && hover !== i && 'opacity-50')}>
                        {sc > 0 && <div style={{ height: (sc / top) * H, background: SCHOOLS, marginBottom: both ? 2 : 0 }} className="w-full rounded-t-[4px]" />}
                        {sw > 0 && <div style={{ height: (sw / top) * H, background: SWISH }} className={clsx('w-full', !both && 'rounded-t-[4px]')} />}
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="absolute inset-x-0 bottom-0 flex h-6">
                {months.map((m, i) => (
                  <span key={m.month} className={clsx('flex-1 text-center text-[11px] pt-1.5 capitalize', hover === i ? 'text-white' : 'text-white/40', i % 2 === 1 && 'invisible sm:visible')}>
                    {label(m.month, 'short')}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
