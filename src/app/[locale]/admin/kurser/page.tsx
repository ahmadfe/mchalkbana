'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { ChevronRight, Plus } from 'lucide-react';
import clsx from 'clsx';
import AdminShell from '@/components/admin/AdminShell';
import { Badge, Select } from '@/components/admin/ui';
import KindBadge from '@/components/admin/KindBadge';

interface KursRow {
  id: number;
  startTime: string;
  endTime: string;
  title: string;
  courseType: string;
  location: string;
  filialName: string;
  seatLimit: number;
  booked: number;
  unpaid: number;
  status: string;
  visibility: string;
  reportToTS: boolean;
  reportedAt: string | null;
  instructors: string[];
}

const tz = { timeZone: 'Europe/Stockholm' } as const;
const hm = (iso: string) => new Date(iso).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', ...tz });
const dayLabel = (iso: string) => {
  const s = new Date(iso).toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long', ...tz });
  return s.charAt(0).toUpperCase() + s.slice(1);
};
const monthKey = (iso: string) => new Date(iso).toLocaleDateString('sv-SE', { month: 'long', year: 'numeric', ...tz });

export default function KurserPage() {
  const locale = useLocale();
  const [view, setView] = useState<'upcoming' | 'past'>('upcoming');
  const [filialId, setFilialId] = useState('');
  const [rows, setRows] = useState<KursRow[] | null>(null);
  const [filialer, setFilialer] = useState<{ id: number; name: string }[]>([]);

  useEffect(() => {
    fetch('/api/admin/filialer').then(r => r.json()).then(d => setFilialer(d.filialer ?? []));
  }, []);

  useEffect(() => {
    setRows(null);
    const params = new URLSearchParams({ view, ...(filialId ? { filialId } : {}) });
    fetch(`/api/admin/kurser?${params}`).then(r => r.json()).then(d => setRows(d.kurser ?? []));
  }, [view, filialId]);

  // Gruppera per månad så att långa listor går att skumma
  const groups: { month: string; items: KursRow[] }[] = [];
  for (const r of rows ?? []) {
    const m = monthKey(r.startTime);
    if (groups[groups.length - 1]?.month !== m) groups.push({ month: m, items: [] });
    groups[groups.length - 1].items.push(r);
  }

  return (
    <AdminShell
      title="Kurser"
      actions={
        <Link href={`/${locale}/admin/kurser/ny`} className="inline-flex items-center gap-1.5 h-11 px-5 rounded-full bg-white text-black text-sm font-semibold hover:bg-white/90">
          <Plus className="w-4 h-4" /> Ny kurs
        </Link>
      }
    >
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="inline-flex p-1 rounded-2xl bg-[#1c1c1f] self-start">
          {(['upcoming', 'past'] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={clsx('px-4 py-2 rounded-xl text-sm font-semibold transition', view === v ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white')}
            >
              {v === 'upcoming' ? 'Kommande' : 'Genomförda'}
            </button>
          ))}
        </div>
        {filialer.length > 1 && (
          <Select value={filialId} onChange={e => setFilialId(e.target.value)} className="sm:w-56 sm:ml-auto bg-[#1c1c1f]">
            <option value="">Alla filialer</option>
            {filialer.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </Select>
        )}
      </div>

      {rows === null ? (
        <div className="py-20 flex justify-center"><div className="w-6 h-6 border-2 border-white/50 border-t-transparent rounded-full animate-spin" /></div>
      ) : rows.length === 0 ? (
        <div className="rounded-3xl bg-[#1c1c1f] p-10 text-center text-white/50">
          {view === 'upcoming' ? 'Inga kommande kurser. Skapa en med "Ny kurs".' : 'Inga genomförda kurser.'}
        </div>
      ) : (
        <div className="space-y-8">
          {groups.map(g => (
            <div key={g.month}>
              <h2 className="text-xs font-bold uppercase tracking-[0.12em] text-white/40 mb-3">{g.month}</h2>
              <div className="space-y-2">
                {g.items.map(k => {
                  const full = k.booked >= k.seatLimit;
                  const unreported = view === 'past' && k.reportToTS && !k.reportedAt && k.status !== 'canceled';
                  return (
                    <Link
                      key={k.id}
                      href={`/${locale}/admin/kurser/${k.id}`}
                      className={clsx(
                        'flex items-center gap-4 rounded-2xl bg-[#1c1c1f] hover:bg-[#232327] px-5 py-4 transition',
                        k.status === 'canceled' && 'opacity-60',
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <KindBadge type={k.courseType} />
                          <span className={clsx('font-bold truncate', k.status === 'canceled' && 'line-through')}>{k.title}</span>
                          {k.status === 'canceled' && <Badge tone="red">Inställd</Badge>}
                          {k.visibility !== 'public' && k.status !== 'canceled' && <Badge>Ej bokningsbar</Badge>}
                          {unreported && <Badge tone="amber">Ej rapporterad</Badge>}
                        </div>
                        <p className="text-sm text-white/50 mt-1 truncate">
                          {dayLabel(k.startTime)} {hm(k.startTime)}–{hm(k.endTime)} · {k.location}
                          {k.instructors.length > 0 && ` · ${k.instructors.join(', ')}`}
                        </p>
                        {k.unpaid > 0 && k.status !== 'canceled' && (
                          <p className="text-sm text-red-400 mt-0.5">{k.unpaid} inte betald{k.unpaid === 1 ? '' : 'a'}</p>
                        )}
                      </div>
                      <span className={clsx(
                        'px-2.5 py-1 rounded-full text-xs font-bold shrink-0',
                        full ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/10 text-white/70',
                      )}>
                        {k.booked}/{k.seatLimit}
                      </span>
                      <ChevronRight className="w-4 h-4 text-white/30 shrink-0" />
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminShell>
  );
}
