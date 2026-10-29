'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { Copy, Download, Power, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import AdminShell from '@/components/admin/AdminShell';
import { Badge, Button, formatDate } from '@/components/admin/ui';
import { kr } from '@/components/admin/invoice';

type State = 'used' | 'reserved' | 'disabled' | 'expired' | 'unused';
interface Code {
  id: number; code: string; state: State; disabled: boolean;
  booking: { name: string; sessionId: number; course: string; startTime: string; price: number | null; discount: number | null } | null;
}
interface Data {
  batch: { id: number; name: string; label: string; validTo: string | null; courses: string[]; createdBy: string; createdAt: string };
  codes: Code[];
}

const STATE: Record<State, { label: string; tone: 'neutral' | 'blue' | 'green' | 'amber' | 'red' }> = {
  unused: { label: 'Oanvänd', tone: 'green' },
  reserved: { label: 'Betalas just nu', tone: 'amber' },
  used: { label: 'Använd', tone: 'blue' },
  disabled: { label: 'Avstängd', tone: 'red' },
  expired: { label: 'Utgången', tone: 'neutral' },
};
const FILTERS: [string, string][] = [['all', 'Alla'], ['unused', 'Oanvända'], ['used', 'Använda'], ['off', 'Avstängda']];

export default function RabattkodOmgangPage({ params }: { params: { id: string } }) {
  const locale = useLocale();
  const router = useRouter();
  const [data, setData] = useState<Data | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [filter, setFilter] = useState('all');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/rabattkoder/${params.id}`);
    if (!res.ok) { setNotFound(true); return; }
    setData(await res.json());
  }, [params.id]);
  useEffect(() => { load(); }, [load]);

  const back = { href: '/admin/rabattkoder', label: 'Rabattkoder' };
  if (notFound) return <AdminShell title="Omgången hittades inte" back={back}><p className="text-white/60">Den kan ha tagits bort.</p></AdminShell>;
  if (!data) {
    return (
      <AdminShell title="Rabattkoder" back={back}>
        <div className="py-20 flex justify-center"><div className="w-6 h-6 border-2 border-white/50 border-t-transparent rounded-full animate-spin" /></div>
      </AdminShell>
    );
  }

  const { batch, codes } = data;
  const unused = codes.filter(c => c.state === 'unused');
  const used = codes.filter(c => c.state === 'used');
  const anyOn = codes.some(c => !c.disabled && c.state !== 'used');
  const shown = codes.filter(c =>
    filter === 'all' ? true : filter === 'unused' ? c.state === 'unused' || c.state === 'reserved' : filter === 'used' ? c.state === 'used' : c.state === 'disabled' || c.state === 'expired');
  const validToDay = batch.validTo ? formatDate(new Date(new Date(batch.validTo).getTime() - 1).toISOString()) : null;

  const copyUnused = async () => {
    await navigator.clipboard.writeText(unused.map(c => c.code).join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadCsv = () => {
    const rows = [['Kod', 'Rabatt', 'Status', 'Elev', 'Kurs', 'Kursdatum', 'Betalt', 'Rabatt kr']].concat(codes.map(c => [
      c.code, batch.label, STATE[c.state].label, c.booking?.name ?? '', c.booking?.course ?? '',
      c.booking ? formatDate(c.booking.startTime) : '', c.booking?.price != null ? String(c.booking.price) : '', c.booking?.discount != null ? String(c.booking.discount) : '',
    ]));
    const csv = '﻿' + rows.map(r => r.map(v => `"${v.replace(/"/g, '""')}"`).join(';')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `rabattkoder-${batch.name.replace(/[^\wåäöÅÄÖ-]+/g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const patch = async (url: string, disabled: boolean) => {
    setError('');
    const res = await fetch(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ disabled }) });
    if (!res.ok) setError('Något gick fel');
    load();
  };

  const toggleAll = () => {
    if (anyOn && !confirm(`Stänga av alla oanvända koder i "${batch.name}"? Ingen av dem kan användas efter det.`)) return;
    patch(`/api/admin/rabattkoder/${batch.id}`, anyOn);
  };

  const remove = async () => {
    if (!confirm(`Ta bort "${batch.name}" och alla ${codes.length} koder? Det går inte att ångra.`)) return;
    const res = await fetch(`/api/admin/rabattkoder/${batch.id}`, { method: 'DELETE' });
    if (!res.ok) { setError((await res.json()).error ?? 'Något gick fel'); return; }
    router.push(`/${locale}/admin/rabattkoder`);
  };

  return (
    <AdminShell title={batch.name} back={back}>
      <p className="text-sm text-white/60 -mt-6 mb-6">
        −{batch.label} · {batch.courses.length ? batch.courses.join(', ') : 'alla kurser'} · {validToDay ? `gäller t.o.m. ${validToDay}` : 'ingen slutdag'}
        <br /><span className="text-white/40">Skapad {formatDate(batch.createdAt)}{batch.createdBy ? ` av ${batch.createdBy}` : ''}</span>
      </p>

      <div className="grid grid-cols-3 gap-3 mb-5">
        {[['Koder', codes.length], ['Använda', used.length], ['Kvar', unused.length]].map(([label, n]) => (
          <div key={label} className="rounded-2xl bg-[#1c1c1f] p-4">
            <p className="font-headline text-2xl font-extrabold">{n}</p>
            <p className="text-sm text-white/50">{label}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 mb-5">
        <Button variant="primary" onClick={copyUnused} disabled={unused.length === 0}><Copy className="w-4 h-4" /> {copied ? 'Kopierat!' : `Kopiera ${unused.length} oanvända`}</Button>
        <Button onClick={downloadCsv}><Download className="w-4 h-4" /> Ladda ner (CSV)</Button>
        {codes.some(c => c.state !== 'used' && c.state !== 'reserved') && (
          <Button onClick={toggleAll}><Power className="w-4 h-4" /> {anyOn ? 'Stäng av alla' : 'Sätt på alla'}</Button>
        )}
        {used.length === 0 && !codes.some(c => c.state === 'reserved') && (
          <Button onClick={remove} className="text-red-300"><Trash2 className="w-4 h-4" /> Ta bort</Button>
        )}
      </div>
      {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

      <div className="flex p-1 rounded-2xl bg-[#1c1c1f] mb-4 sm:max-w-lg">
        {FILTERS.map(([k, label]) => (
          <button key={k} onClick={() => setFilter(k)} className={clsx('flex-1 h-10 rounded-xl text-sm font-semibold transition', filter === k ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white')}>{label}</button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="rounded-3xl bg-[#1c1c1f] p-8 text-center text-white/50">Inga koder här.</div>
      ) : (
        <div className="rounded-3xl bg-[#1c1c1f] divide-y divide-white/5">
          {shown.map(c => (
            <div key={c.id} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 px-4 sm:px-5 py-3">
              <div className="flex items-center gap-3 sm:w-64 shrink-0">
                <span className={clsx('font-mono font-bold tracking-wider', (c.state === 'disabled' || c.state === 'expired') && 'line-through text-white/40')}>{c.code}</span>
                <Badge tone={STATE[c.state].tone}>{STATE[c.state].label}</Badge>
              </div>
              <div className="flex-1 min-w-0 text-sm text-white/60">
                {c.booking && (
                  <Link href={`/${locale}/admin/kurser/${c.booking.sessionId}`} className="hover:text-white hover:underline">
                    <strong className="text-white">{c.booking.name}</strong> · {c.booking.course} {formatDate(c.booking.startTime, { day: 'numeric', month: 'short' })}
                    {c.booking.price != null && ` · betalade ${kr(c.booking.price)}`}
                    {c.booking.discount ? ` (−${kr(c.booking.discount)})` : ''}
                  </Link>
                )}
              </div>
              {c.state !== 'used' && c.state !== 'reserved' && c.state !== 'expired' && (
                <button
                  onClick={() => patch(`/api/admin/rabattkoder/kod/${c.id}`, !c.disabled)}
                  className={clsx('self-start sm:self-auto h-9 px-3 rounded-full text-sm font-semibold border border-white/10', c.disabled ? 'text-emerald-300 hover:bg-emerald-500/10' : 'text-white/70 hover:bg-white/10')}
                >
                  {c.disabled ? 'Sätt på' : 'Stäng av'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </AdminShell>
  );
}
