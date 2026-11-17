'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { AlertCircle, ChevronLeft, ChevronRight, Download, Pencil, RotateCcw, Search } from 'lucide-react';
import clsx from 'clsx';
import AdminShell from '@/components/admin/AdminShell';
import { Badge, Button, Input, Select, formatDate } from '@/components/admin/ui';
import { kr, periodLabel } from '@/components/admin/invoice';
import { useAuth } from '@/context/AuthContext';
import { isOwner } from '@/lib/owner';

interface Slot { id: number; startTime: string; endTime: string; course: string; behorighet: string }
interface Row {
  key: string;
  kind: 'payment' | 'credit' | 'invoice';
  id: number;
  date: string;
  amount: number;
  method: string;
  status: string;
  note: string;
  name: string;
  personnummer?: string | null;
  contact?: string;
  studentId?: number | null;
  school: string | null;
  schoolId?: number;
  coupon?: string | null;
  transactionId?: string | null;
  slot?: Slot | null;
  invoice?: { id: number; number: number } | null;
  period?: string;
  students?: number;
}

/** Elev som inte har betalat och inte har någon trafikskola */
interface UnpaidRow {
  bookingId: number;
  name: string;
  personnummer: string | null;
  phone: string | null;
  email: string | null;
  studentId: number | null;
  attendance: string;
  note: string;
  pending: string | null;
  amount: number;
  slot: { id: number; startTime: string; endTime: string; course: string };
}

type Mode = 'day' | 'week' | 'month' | 'year' | 'custom';
type Who = 'all' | 'private' | 'school';

const METHOD_LABEL: Record<string, string> = {
  swish: 'Swish', cash: 'Kontant', card: 'Kort', free: 'Gratis', klarna: 'Klarna', invoice: 'Faktura', manual: 'Manuell', stripe: 'Kort', other: 'Annat',
};
const STATUS: Record<string, { label: string; tone: 'green' | 'amber' | 'blue' | 'neutral' }> = {
  Succeeded: { label: 'Betald', tone: 'green' },
  Refunded: { label: 'Återbetald', tone: 'amber' },
  Authorized: { label: 'Reserverad', tone: 'blue' },
  Canceled: { label: 'Släppt', tone: 'neutral' },
};

const tz = { timeZone: 'Europe/Stockholm' } as const;
const hm = (iso: string) => new Date(iso).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', ...tz });
const ymd = (d: Date) => d.toLocaleDateString('sv-SE');

/** Periodens start och slut (lokal tid) för läge och steg bakåt/framåt */
function range(mode: Mode, offset: number, custom: { from: string; to: string }): { from: Date; to: Date; label: string } {
  const now = new Date();
  if (mode === 'custom') {
    const from = new Date(`${custom.from}T00:00:00`);
    const to = new Date(`${custom.to}T00:00:00`);
    to.setDate(to.getDate() + 1);
    return { from, to, label: `${formatDate(from.toISOString())} – ${formatDate(new Date(to.getTime() - 1).toISOString())}` };
  }
  if (mode === 'day') {
    const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    const to = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 1);
    const d = from.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' });
    const label = offset === 0 ? 'Idag' : offset === -1 ? 'Igår' : d.charAt(0).toUpperCase() + d.slice(1);
    return { from, to, label };
  }
  if (mode === 'week') {
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7) + offset * 7);
    const to = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 7);
    // ISO-veckonummer
    const t = new Date(Date.UTC(monday.getFullYear(), monday.getMonth(), monday.getDate() + 3));
    const week = Math.ceil(((t.getTime() - Date.UTC(t.getUTCFullYear(), 0, 1)) / 86400000 + 1) / 7);
    const end = new Date(to.getTime() - 86400000);
    return { from: monday, to, label: `Vecka ${week} · ${monday.getDate()} ${monday.toLocaleDateString('sv-SE', { month: 'short' })} – ${end.getDate()} ${end.toLocaleDateString('sv-SE', { month: 'short' })}` };
  }
  if (mode === 'month') {
    const from = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const to = new Date(from.getFullYear(), from.getMonth() + 1, 1);
    const label = from.toLocaleDateString('sv-SE', { month: 'long', year: 'numeric' });
    return { from, to, label: label.charAt(0).toUpperCase() + label.slice(1) };
  }
  const from = new Date(now.getFullYear() + offset, 0, 1);
  return { from, to: new Date(from.getFullYear() + 1, 0, 1), label: String(from.getFullYear()) };
}

export default function BetalningarPage() {
  const locale = useLocale();
  const { user, isLoading: authLoading } = useAuth();
  const owner = isOwner(user);
  const [mode, setMode] = useState<Mode>('month');
  const [offset, setOffset] = useState(0);
  const today = ymd(new Date());
  const [custom, setCustom] = useState({ from: today.slice(0, 8) + '01', to: today });
  const [rows, setRows] = useState<Row[] | null>(null);
  const [who, setWho] = useState<Who>('all');
  const [method, setMethod] = useState('all');
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const [view, setView] = useState<'paid' | 'unpaid'>('paid');
  const [unpaid, setUnpaid] = useState<UnpaidRow[] | null>(null);

  const period = useMemo(() => range(mode, offset, custom), [mode, offset, custom]);

  const load = useCallback(async () => {
    if (isNaN(period.from.getTime()) || isNaN(period.to.getTime())) return;
    setRows(null);
    const res = await fetch(`/api/admin/betalningar?from=${period.from.toISOString()}&to=${period.to.toISOString()}`);
    const body = await res.json();
    if (!res.ok) { setError(body.error ?? 'Något gick fel'); setRows([]); return; }
    setError('');
    setRows(body.rows);
  }, [period]);
  useEffect(() => { if (owner) load(); }, [owner, load]);

  // Obetalda – alltid alla, oavsett period
  const loadUnpaid = useCallback(async () => {
    const res = await fetch('/api/admin/betalningar/obetalda');
    const body = await res.json().catch(() => ({}));
    setUnpaid(res.ok ? body.rows : []);
  }, []);
  useEffect(() => { if (owner) loadUnpaid(); }, [owner, loadUnpaid]);
  const unpaidSum = (unpaid ?? []).reduce((s, r) => s + r.amount, 0);

  const isSchool = (r: Row) => r.kind !== 'payment' || !!r.school;
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (rows ?? []).filter(r =>
      (who === 'all' || (who === 'school') === isSchool(r)) &&
      (method === 'all' || r.method === method) &&
      (!needle || [r.name, r.personnummer, r.school, r.note, r.contact, r.slot?.course].some(v => v?.toLowerCase().includes(needle))),
    );
  }, [rows, who, method, q]);

  // Summorna följer filtren – bara pengar som faktiskt kommit in
  const paid = shown.filter(r => r.status === 'Succeeded');
  const sum = (list: Row[]) => list.reduce((s, r) => s + r.amount, 0);
  const totals = {
    all: sum(paid),
    swish: sum(paid.filter(r => r.method === 'swish')),
    cashCard: sum(paid.filter(r => ['cash', 'card', 'stripe', 'manual', 'other'].includes(r.method))),
    klarna: sum(paid.filter(r => r.method === 'klarna')),
    schools: sum(paid.filter(r => r.kind === 'invoice')),
    refunded: sum(shown.filter(r => r.status === 'Refunded')),
  };
  const unpaidShown = (unpaid ?? []).filter(r => {
    const needle = q.trim().toLowerCase();
    return !needle || [r.name, r.personnummer, r.phone, r.email, r.note, r.slot.course].some(v => v?.toLowerCase().includes(needle));
  });
  const methods = Array.from(new Set((rows ?? []).map(r => r.method)));

  const exportCsv = () => {
    if (view === 'unpaid') return exportUnpaidCsv(unpaidShown);
    const head = ['Datum', 'Namn', 'Personnummer', 'Privat/Skola', 'Kurs', 'Kurstillfälle', 'Betalsätt', 'Status', 'Belopp', 'Anteckning'];
    const lines = shown.map(r => [
      ymd(new Date(r.date)), r.name, r.personnummer ?? '', r.school ?? 'Privat', r.slot?.course ?? (r.period ? `Faktura ${periodLabel(r.period)}` : ''),
      r.slot ? `${ymd(new Date(r.slot.startTime))} ${hm(r.slot.startTime)}` : '', METHOD_LABEL[r.method] ?? r.method, STATUS[r.status]?.label ?? r.status, String(r.amount), r.note,
    ]);
    const csv = [head, ...lines].map(l => l.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `betalningar-${ymd(period.from)}.csv`;
    a.click();
  };

  if (!authLoading && !owner) {
    return <AdminShell title="Betalningar"><p className="text-white/60">Bara ägaren kan se betalningarna.</p></AdminShell>;
  }

  return (
    <AdminShell title="Betalningar">
      {/* Period */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-5">
        <div className="flex p-1 rounded-2xl bg-[#1c1c1f] overflow-x-auto">
          {([['day', 'Idag'], ['week', 'Vecka'], ['month', 'Månad'], ['year', 'År'], ['custom', 'Eget']] as [Mode, string][]).map(([m, label]) => (
            <button
              key={m}
              onClick={() => { setMode(m); setOffset(0); }}
              className={clsx('flex-1 min-w-max h-10 px-4 rounded-xl text-sm font-semibold transition', mode === m ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white')}
            >
              {label}
            </button>
          ))}
        </div>
        {mode === 'custom' ? (
          <div className="flex items-center gap-2">
            <Input type="date" value={custom.from} onChange={e => setCustom({ ...custom, from: e.target.value })} className="!w-40 [color-scheme:dark]" aria-label="Från" />
            <span className="text-white/50">–</span>
            <Input type="date" value={custom.to} onChange={e => setCustom({ ...custom, to: e.target.value })} className="!w-40 [color-scheme:dark]" aria-label="Till" />
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button onClick={() => setOffset(offset - 1)} aria-label="Föregående" className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/15 flex items-center justify-center"><ChevronLeft className="w-4 h-4" /></button>
            <span className="font-headline font-extrabold text-lg min-w-[10rem] text-center">{period.label}</span>
            <button onClick={() => setOffset(offset + 1)} disabled={offset >= 0} aria-label="Nästa" className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/15 flex items-center justify-center disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
            {offset !== 0 && <button onClick={() => setOffset(0)} className="text-sm text-white/50 hover:text-white underline ml-1">Nu</button>}
          </div>
        )}
      </div>

      {/* Summor */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 mb-5">
        <Stat label="Totalt in" value={totals.all} sub={`${paid.length} betalningar${totals.refunded ? ` · återbetalt ${kr(totals.refunded)}` : ''}`} big />
        <Stat label="Swish" value={totals.swish} />
        <Stat label="Kontant / kort" value={totals.cashCard} />
        <Stat label="Klarna" value={totals.klarna} />
        <Stat label="Skolor (faktura)" value={totals.schools} />
        <button
          onClick={() => setView(view === 'unpaid' ? 'paid' : 'unpaid')}
          className={clsx(
            'rounded-2xl p-4 text-left transition col-span-2 lg:col-span-1 ring-1',
            unpaid?.length ? 'bg-red-500/10 hover:bg-red-500/15' : 'bg-[#1c1c1f]',
            view === 'unpaid' ? 'ring-red-400/60' : 'ring-transparent',
          )}
        >
          <p className={clsx('text-xs font-bold uppercase tracking-[0.1em]', unpaid?.length ? 'text-red-300' : 'text-white/50')}>Obetalt</p>
          <p className="font-headline text-2xl font-extrabold mt-1">{unpaid ? kr(unpaidSum) : '…'}</p>
          <p className="text-xs mt-0.5 text-white/50">{unpaid ? `${unpaid.length} ${unpaid.length === 1 ? 'elev' : 'elever'} · utan skola` : ' '}</p>
        </button>
      </div>

      {/* Betalningar / Obetalda */}
      <div className="flex p-1 rounded-2xl bg-[#1c1c1f] mb-3 w-full sm:w-auto sm:inline-flex">
        {([['paid', 'Betalningar'], ['unpaid', `Obetalda${unpaid ? ` (${unpaid.length})` : ''}`]] as const).map(([v, label]) => (
          <button key={v} onClick={() => setView(v)} className={clsx('flex-1 sm:flex-none h-10 px-5 rounded-xl text-sm font-semibold transition', view === v ? 'bg-white text-black' : 'text-white/60 hover:text-white')}>{label}</button>
        ))}
      </div>

      {/* Filter */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        {view === 'paid' && <div className="flex p-1 rounded-2xl bg-[#1c1c1f] shrink-0">
          {([['all', 'Alla'], ['private', 'Privat'], ['school', 'Skola']] as [Who, string][]).map(([w, label]) => (
            <button key={w} onClick={() => setWho(w)} className={clsx('h-9 px-4 rounded-xl text-sm font-semibold transition', who === w ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white')}>{label}</button>
          ))}
        </div>}
        {view === 'paid' && <Select value={method} onChange={e => setMethod(e.target.value)} className="sm:!w-44" aria-label="Betalsätt">
          <option value="all">Alla betalsätt</option>
          {methods.map(m => <option key={m} value={m}>{METHOD_LABEL[m] ?? m}</option>)}
        </Select>}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Sök namn, personnummer, skola, anteckning…" className="!pl-10" />
        </div>
        <Button onClick={exportCsv} disabled={view === 'paid' ? !shown.length : !unpaidShown.length}><Download className="w-4 h-4" /> CSV</Button>
      </div>

      {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

      {view === 'unpaid' ? (
        <UnpaidList rows={unpaid} shown={unpaidShown} locale={locale} onChange={loadUnpaid} />
      ) : !rows ? (
        <div className="py-20 flex justify-center"><div className="w-6 h-6 border-2 border-white/50 border-t-transparent rounded-full animate-spin" /></div>
      ) : shown.length === 0 ? (
        <div className="rounded-3xl bg-[#1c1c1f] p-10 text-center text-white/50">Inga betalningar {rows.length ? 'som matchar filtret' : 'under perioden'}.</div>
      ) : (
        <div className="rounded-3xl bg-[#1c1c1f] divide-y divide-white/5">
          {shown.map(r => <PaymentRow key={r.key} r={r} locale={locale} onChange={load} />)}
        </div>
      )}
    </AdminShell>
  );
}

function Stat({ label, value, sub, big }: { label: string; value: number; sub?: string; big?: boolean }) {
  return (
    <div className={clsx('rounded-2xl p-4', big ? 'bg-white text-black col-span-2 lg:col-span-1' : 'bg-[#1c1c1f]')}>
      <p className={clsx('text-xs font-bold uppercase tracking-[0.1em]', big ? 'text-black/60' : 'text-white/50')}>{label}</p>
      <p className="font-headline text-2xl font-extrabold mt-1">{kr(value)}</p>
      {sub && <p className={clsx('text-xs mt-0.5', big ? 'text-black/60' : 'text-white/50')}>{sub}</p>}
    </div>
  );
}

function PaymentRow({ r, locale, onChange }: { r: Row; locale: string; onChange: () => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(r.note);
  const [busy, setBusy] = useState(false);
  const st = STATUS[r.status] ?? { label: r.status, tone: 'neutral' as const };

  const saveNote = async () => {
    setBusy(true);
    const res = await fetch('/api/admin/betalningar', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: r.kind, id: r.id, note }) });
    setBusy(false);
    if (!res.ok) { alert((await res.json()).error ?? 'Något gick fel'); return; }
    setEditing(false);
    await onChange();
  };

  const refund = async () => {
    const how = r.method === 'swish' ? 'Pengarna skickas tillbaka via Swish.'
      : r.method === 'klarna' ? (r.status === 'Authorized' ? 'Klarna-reservationen släpps.' : 'Beloppet återbetalas via Klarna.')
      : 'Betalningen markeras som återbetald – lämna tillbaka pengarna själv.';
    if (!confirm(`Återbetala ${kr(r.amount)} till ${r.name}?\n\n${how}\nBokningen avbokas och platsen blir ledig.`)) return;
    setBusy(true);
    const res = await fetch(`/api/admin/payments/${r.id}/refund`, { method: 'POST' });
    setBusy(false);
    if (!res.ok) { alert((await res.json()).error ?? 'Något gick fel'); return; }
    await onChange();
  };

  const name = r.kind === 'invoice'
    ? <Link href={`/${locale}/admin/fakturor/${r.id}`} className="hover:underline">{r.name}</Link>
    : r.studentId ? <Link href={`/${locale}/admin/elever/${r.studentId}`} className="hover:underline">{r.name}</Link> : r.name;
  const school = r.school && (r.schoolId
    ? <Link href={`/${locale}/admin/trafikskolor/${r.schoolId}`} className="text-sky-300 hover:underline">{r.school}</Link>
    : <span className="text-sky-300">{r.school}</span>);

  return (
    <div className="px-5 py-4">
      <div className="flex items-start gap-4">
        <div className="w-14 shrink-0 text-sm text-white/50 pt-0.5">{formatDate(r.date, { day: 'numeric', month: 'short' })}</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-bold truncate">{name}</p>
              <p className="text-sm text-white/55 mt-0.5">
                {r.kind === 'invoice' ? (
                  <>Skola: {school} · {r.students} {r.students === 1 ? 'elev' : 'elever'} · {r.period ? periodLabel(r.period) : ''}</>
                ) : (
                  <>
                    {school ? <>Skola: {school}</> : 'Privat'}
                    {r.personnummer && <span className="font-mono"> · {r.personnummer}</span>}
                  </>
                )}
              </p>
              {r.slot && (
                <Link href={`/${locale}/admin/kurser/${r.slot.id}`} className="inline-flex items-center gap-1 text-sm text-white/70 hover:text-white mt-1">
                  {r.slot.course} · {formatDate(r.slot.startTime, { weekday: 'short', day: 'numeric', month: 'short' })} {hm(r.slot.startTime)}–{hm(r.slot.endTime)}
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              )}
              {r.kind === 'credit' && (
                <p className="text-xs text-emerald-300/90 mt-1">
                  {r.invoice ? <>Avdraget på <Link href={`/${locale}/admin/fakturor/${r.invoice.id}`} className="underline">faktura #{r.invoice.number}</Link></> : 'Dras av på skolans nästa faktura'}
                </p>
              )}
            </div>
            <div className="text-right shrink-0">
              <p className={clsx('font-headline font-extrabold', r.status !== 'Succeeded' && 'text-white/50 line-through decoration-1')}>{kr(r.amount)}</p>
              <div className="flex items-center justify-end gap-1.5 mt-1">
                <span className="text-xs text-white/60">{METHOD_LABEL[r.method] ?? r.method}</span>
                <Badge tone={st.tone}>{st.label}</Badge>
              </div>
            </div>
          </div>

          {editing ? (
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <Input value={note} onChange={e => setNote(e.target.value)} autoFocus placeholder="T.ex. kontant till Ali, Swish från mamma" className="flex-1 min-w-[14rem] !h-10" />
              <Button variant="primary" className="!h-10" onClick={saveNote} disabled={busy}>Spara</Button>
              <Button className="!h-10" onClick={() => { setNote(r.note); setEditing(false); }}>Avbryt</Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm">
              {r.note && <span className="text-amber-200/90">📝 {r.note}</span>}
              {r.coupon && <span className="text-white/50">Rabattkod {r.coupon}</span>}
              {r.kind !== 'invoice' && (
                <button onClick={() => setEditing(true)} className="inline-flex items-center gap-1 text-white/45 hover:text-white">
                  <Pencil className="w-3.5 h-3.5" /> {r.note ? 'Ändra anteckning' : 'Anteckning'}
                </button>
              )}
              {r.kind === 'payment' && (r.status === 'Succeeded' || r.status === 'Authorized') && (
                <button onClick={refund} disabled={busy} className="inline-flex items-center gap-1 text-red-400/80 hover:text-red-300">
                  <RotateCcw className="w-3.5 h-3.5" /> Återbetala
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function exportUnpaidCsv(list: UnpaidRow[]) {
  const head = ['Kursdatum', 'Namn', 'Personnummer', 'Telefon', 'E-post', 'Kurs', 'Belopp', 'Anteckning'];
  const lines = list.map(r => [`${ymd(new Date(r.slot.startTime))} ${hm(r.slot.startTime)}`, r.name, r.personnummer ?? '', r.phone ?? '', r.email ?? '', r.slot.course, String(r.amount), r.note]);
  const csv = [head, ...lines].map(l => l.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `obetalda-${ymd(new Date())}.csv`;
  a.click();
}

const ATTENDANCE: Record<string, { label: string; tone: 'green' | 'red' | 'neutral' | 'amber' }> = {
  attended: { label: 'Närvarande', tone: 'green' },
  no_show: { label: 'Kom inte', tone: 'red' },
  late_cancel: { label: 'Sen avbokning', tone: 'amber' },
};

/** Obetalda elever i två grupper: kursen har varit / kommande kurs */
function UnpaidList({ rows, shown, locale, onChange }: { rows: UnpaidRow[] | null; shown: UnpaidRow[]; locale: string; onChange: () => Promise<void> }) {
  if (!rows) return <div className="py-20 flex justify-center"><div className="w-6 h-6 border-2 border-white/50 border-t-transparent rounded-full animate-spin" /></div>;
  if (rows.length === 0) return <div className="rounded-3xl bg-[#1c1c1f] p-10 text-center text-white/50">Alla elever har betalat eller har en trafikskola.</div>;

  const now = Date.now();
  const held = shown.filter(r => new Date(r.slot.startTime).getTime() <= now);
  const coming = shown.filter(r => new Date(r.slot.startTime).getTime() > now).reverse(); // närmast först
  const sum = (l: UnpaidRow[]) => l.reduce((s, r) => s + r.amount, 0);

  const group = (title: string, list: UnpaidRow[], tone: string) => list.length > 0 && (
    <section>
      <div className="flex items-baseline justify-between gap-3 px-1 mb-2">
        <h2 className={clsx('text-xs font-bold uppercase tracking-[0.12em]', tone)}>{title} · {list.length} {list.length === 1 ? 'elev' : 'elever'}</h2>
        <span className="text-sm font-bold">{kr(sum(list))}</span>
      </div>
      <div className="rounded-3xl bg-[#1c1c1f] divide-y divide-white/5">
        {list.map(r => <UnpaidItem key={r.bookingId} r={r} locale={locale} onChange={onChange} />)}
      </div>
    </section>
  );

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-white/[0.04] px-4 py-3 text-sm text-white/60 flex items-start gap-2">
        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-white/40" />
        <span>Elever som inte har någon betalning och ingen trafikskola – alla datum, oavsett period. Öppna kursen för att registrera betalning eller välja skola.</span>
      </div>
      {shown.length === 0 && <div className="rounded-3xl bg-[#1c1c1f] p-10 text-center text-white/50">Ingen obetald elev matchar sökningen.</div>}
      {group('Kursen har varit', held, 'text-red-300')}
      {group('Kommande kurs', coming, 'text-amber-300')}
    </div>
  );
}

function UnpaidItem({ r, locale, onChange }: { r: UnpaidRow; locale: string; onChange: () => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(r.note);
  const [busy, setBusy] = useState(false);
  const start = new Date(r.slot.startTime);
  const days = Math.floor((Date.now() - start.getTime()) / 86400000);
  const ago = days < 0 ? (days === -1 ? 'imorgon' : `om ${-days} dagar`) : days === 0 ? 'idag' : days === 1 ? 'igår' : `${days} dagar sedan`;
  const att = ATTENDANCE[r.attendance];

  const saveNote = async () => {
    setBusy(true);
    const res = await fetch('/api/admin/betalningar', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'booking', id: r.bookingId, note }) });
    setBusy(false);
    if (!res.ok) { alert((await res.json().catch(() => ({}))).error ?? 'Något gick fel'); return; }
    setEditing(false);
    await onChange();
  };

  return (
    <div className="px-5 py-4">
      <div className="flex items-start gap-4">
        <div className="w-14 shrink-0 text-sm text-white/50 pt-0.5">{formatDate(r.slot.startTime, { day: 'numeric', month: 'short' })}</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-bold truncate">
                {r.studentId ? <Link href={`/${locale}/admin/elever/${r.studentId}`} className="hover:underline">{r.name}</Link> : r.name}
              </p>
              <p className="text-sm text-white/55 mt-0.5">
                Privat{r.personnummer && <span className="font-mono"> · {r.personnummer}</span>}{r.phone && <> · {r.phone}</>}
              </p>
              <Link href={`/${locale}/admin/kurser/${r.slot.id}`} className="inline-flex items-center gap-1 text-sm text-white/70 hover:text-white mt-1">
                {r.slot.course} · {formatDate(r.slot.startTime, { weekday: 'short', day: 'numeric', month: 'short' })} {hm(r.slot.startTime)}–{hm(r.slot.endTime)}
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="text-right shrink-0">
              <p className="font-headline font-extrabold">{kr(r.amount)}</p>
              <div className="flex items-center justify-end gap-1.5 mt-1">
                <span className="text-xs text-white/50">{ago}</span>
                <Badge tone={days >= 0 ? 'red' : 'amber'}>Obetald</Badge>
              </div>
              {att && <div className="mt-1"><Badge tone={att.tone}>{att.label}</Badge></div>}
            </div>
          </div>

          {editing ? (
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <Input value={note} onChange={e => setNote(e.target.value)} autoFocus placeholder="T.ex. lovat att Swisha fredag" className="flex-1 min-w-[14rem] !h-10" />
              <Button variant="primary" className="!h-10" onClick={saveNote} disabled={busy}>Spara</Button>
              <Button className="!h-10" onClick={() => { setNote(r.note); setEditing(false); }}>Avbryt</Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm">
              {r.note && <span className="text-amber-200/90">📝 {r.note}</span>}
              {r.pending && <span className="text-white/45">Påbörjad: {r.pending}</span>}
              <button onClick={() => setEditing(true)} className="inline-flex items-center gap-1 text-white/45 hover:text-white">
                <Pencil className="w-3.5 h-3.5" /> {r.note ? 'Ändra anteckning' : 'Anteckning'}
              </button>
              <Link href={`/${locale}/admin/kurser/${r.slot.id}`} className="inline-flex items-center gap-1 text-sky-300 hover:text-sky-200">
                Öppna kursen <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
