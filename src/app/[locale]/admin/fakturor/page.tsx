'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { ChevronDown, ChevronRight, Download, Info, Settings } from 'lucide-react';
import clsx from 'clsx';
import AdminShell from '@/components/admin/AdminShell';
import { Button, Checkbox, Field, Input, formatDate } from '@/components/admin/ui';
import { InvoiceStatus, kr, periodLabel } from '@/components/admin/invoice';

interface DraftLine { sessionId: number; date: string; description: string; quantity: number; unitPrice: number; amount: number; students: string[] }
interface Draft { schoolUserId: number; schoolName: string; email: string; period: string; lines: DraftLine[]; total: number; students: number }
interface InvoiceRow {
  id: number; number: number; period: string; status: 'created' | 'sent' | 'paid' | 'credited';
  issueDate: string; dueDate: string; total: number; buyerName: string; sentAt: string | null; paidAt: string | null; students: number; creditOfId: number | null;
}
interface Data {
  missing: string[];
  company: { startPeriod: string };
  drafts: Draft[];
  invoices: InvoiceRow[];
  stats: { toInvoiceExVat: number; toInvoiceSeats: number; unpaid: number; unpaidCount: number; overdue: number; overdueCount: number; paid30: number };
}

type Tab = 'tosend' | 'unpaid' | 'done' | 'all';

export default function FakturorPage() {
  const locale = useLocale();
  const [data, setData] = useState<Data | null>(null);
  const [tab, setTab] = useState<Tab>('tosend');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(() => fetch('/api/admin/fakturor').then(r => r.json()).then(setData), []);
  useEffect(() => { load(); }, [load]);

  const create = async (d: Draft) => {
    const key = `${d.schoolUserId}|${d.period}`;
    setBusy(key);
    setError('');
    const res = await fetch('/api/admin/fakturor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schoolUserId: d.schoolUserId, period: d.period }),
    });
    const body = await res.json();
    setBusy(null);
    if (!res.ok) { setError(body.error ?? 'Något gick fel'); return; }
    window.location.href = `/${locale}/admin/fakturor/${body.id}`;
  };

  const s = data?.stats;
  const created = data?.invoices.filter(i => i.status === 'created') ?? [];
  const lists: Record<Exclude<Tab, 'tosend'>, InvoiceRow[]> = {
    unpaid: data?.invoices.filter(i => i.status === 'sent' && !i.creditOfId) ?? [],
    done: data?.invoices.filter(i => i.status === 'paid' || i.status === 'credited' || (i.creditOfId && i.status === 'sent')) ?? [],
    all: data?.invoices ?? [],
  };
  const tabs: [Tab, string][] = [
    ['tosend', `Att skicka${data ? ` (${data.drafts.length + created.length})` : ''}`],
    ['unpaid', 'Obetalda'],
    ['done', 'Betalda och krediterade'],
    ['all', 'Alla'],
  ];

  return (
    <AdminShell
      title="Fakturor"
      actions={
        <Link href={`/${locale}/admin/fakturor/installningar`} className="inline-flex items-center gap-2 h-11 px-5 rounded-full bg-white/10 border border-white/10 text-sm font-semibold hover:bg-white/15">
          <Settings className="w-4 h-4" /> <span className="hidden sm:inline">Inställningar</span>
        </Link>
      }
    >
      {data && data.missing.length > 0 && (
        <div className="flex items-start gap-3 rounded-2xl bg-sky-500/10 border border-sky-500/20 px-4 py-3 mb-5 text-sm text-white/85">
          <Info className="w-5 h-5 text-sky-300 shrink-0 mt-0.5" />
          <p>
            Fakturorna saknar {data.missing.join(', ')}. Fyll i det under{' '}
            <Link href={`/${locale}/admin/fakturor/installningar`} className="font-semibold underline">Inställningar</Link> innan du skickar.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatCard label="Att fakturera" value={s ? kr(s.toInvoiceExVat) : '–'} sub={s ? `${s.toInvoiceSeats} platser exkl. moms` : ''} />
        <StatCard label="Obetalt" value={s ? kr(s.unpaid) : '–'} sub="inkl. moms" />
        <StatCard label="Förfallet" value={s ? kr(s.overdue) : '–'} sub="efter sista betalningsdag" alert={!!s && s.overdue > 0} />
        <StatCard label="Betalt 30 dagar" value={s ? kr(s.paid30) : '–'} sub="inkl. moms" />
      </div>

      <div className="flex p-1 rounded-2xl bg-[#1c1c1f] mb-5 overflow-x-auto">
        {tabs.map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={clsx('flex-1 min-w-max h-10 px-4 rounded-xl text-sm font-semibold transition', tab === t ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white')}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

      {!data ? (
        <div className="py-20 flex justify-center"><div className="w-6 h-6 border-2 border-white/50 border-t-transparent rounded-full animate-spin" /></div>
      ) : tab === 'tosend' ? (
        <div className="space-y-3">
          {created.map(inv => <InvoiceItem key={inv.id} inv={inv} locale={locale} />)}
          {data.drafts.map(d => {
            const key = `${d.schoolUserId}|${d.period}`;
            const isOpen = open === key;
            return (
              <div key={key} className="rounded-2xl bg-[#1c1c1f]">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4">
                  <button onClick={() => setOpen(isOpen ? null : key)} className="flex items-center gap-3 min-w-0 flex-1 text-left">
                    <ChevronDown className={clsx('w-4 h-4 text-white/40 shrink-0 transition', !isOpen && '-rotate-90')} />
                    <div className="min-w-0">
                      <p className="font-bold truncate">{d.schoolName}</p>
                      <p className="text-sm text-white/50">{periodLabel(d.period)} · {d.students} {d.students === 1 ? 'elev' : 'elever'} · {d.lines.length} {d.lines.length === 1 ? 'kurs' : 'kurser'}</p>
                    </div>
                  </button>
                  <div className="flex items-center justify-between sm:justify-end gap-4">
                    <span className="font-headline font-extrabold">{kr(d.total)}</span>
                    <Button variant="primary" onClick={() => create(d)} disabled={busy !== null}>
                      {busy === key ? 'Skapar…' : 'Skapa faktura'}
                    </Button>
                  </div>
                </div>
                {isOpen && (
                  <div className="border-t border-white/5 px-5 py-3 space-y-2">
                    {d.lines.map(l => (
                      <div key={`${l.sessionId}-${l.unitPrice}`} className="flex items-start justify-between gap-4 text-sm">
                        <div className="min-w-0">
                          <p className="font-semibold">{formatDate(l.date, { day: 'numeric', month: 'short' })} · {l.description}</p>
                          <p className="text-white/45">{l.students.join(', ')}</p>
                        </div>
                        <p className="shrink-0 text-white/70">{l.quantity} × {kr(l.unitPrice)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {created.length === 0 && data.drafts.length === 0 && (
            <Empty>
              Inget att fakturera just nu. Trafikskolornas elever dyker upp här när kursen har hållits
              (kurser från och med {periodLabel(data.company.startPeriod).toLowerCase()}).
            </Empty>
          )}
        </div>
      ) : lists[tab].length === 0 ? (
        <Empty>{tab === 'unpaid' ? 'Inga obetalda fakturor.' : tab === 'done' ? 'Inga betalda eller krediterade fakturor än.' : 'Inga fakturor än.'}</Empty>
      ) : (
        <div className="space-y-2">{lists[tab].map(inv => <InvoiceItem key={inv.id} inv={inv} locale={locale} />)}</div>
      )}

      <SieExport />
    </AdminShell>
  );
}

/** Bokföring: SIE-fil för en period, att läsa in i Fortnox, Visma m.fl. */
function SieExport() {
  const thisMonth = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' }).slice(0, 7);
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(thisMonth);
  const [to, setTo] = useState(thisMonth);
  const [payments, setPayments] = useState(true);
  const href = `/api/admin/fakturor/sie?from=${from}&to=${to || from}&payments=${payments ? 1 : 0}`;
  return (
    <div className="rounded-2xl bg-[#1c1c1f] mt-5">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left">
        <span className="font-bold">Bokföring (SIE)</span>
        <ChevronDown className={clsx('w-4 h-4 text-white/50 transition', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="border-t border-white/5 px-5 py-4 space-y-4">
          <p className="text-sm text-white/60">
            Ladda ner fakturorna som en SIE 4-fil och läs in den i bokföringsprogrammet. Varje faktura bokförs på kundfordringar,
            försäljning och utgående moms{payments ? ', och varje betalning på bank mot kundfordringar' : ''}.
          </p>
          <div className="grid sm:grid-cols-2 gap-4 sm:max-w-md">
            <Field label="Från och med"><Input type="month" value={from} onChange={e => setFrom(e.target.value)} /></Field>
            <Field label="Till och med"><Input type="month" value={to} onChange={e => setTo(e.target.value)} /></Field>
          </div>
          <Checkbox checked={payments} onChange={setPayments}>Ta med betalningar</Checkbox>
          <a
            href={href}
            className={clsx('inline-flex items-center gap-2 h-11 px-5 rounded-full bg-white text-black text-sm font-semibold hover:bg-white/90', (!from || (to && to < from)) && 'pointer-events-none opacity-40')}
          >
            <Download className="w-4 h-4" /> Ladda ner SIE-fil
          </a>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, sub, alert }: { label: string; value: string; sub: string; alert?: boolean }) {
  return (
    <div className="rounded-2xl bg-[#1c1c1f] p-4">
      <p className="text-sm text-white/60">{label}</p>
      <p className={clsx('font-headline text-2xl font-extrabold mt-1', alert && 'text-red-400')}>{value}</p>
      <p className="text-xs text-white/40 mt-0.5">{sub}</p>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl bg-[#1c1c1f] px-5 py-6 text-white/50">{children}</div>;
}

function InvoiceItem({ inv, locale }: { inv: InvoiceRow; locale: string }) {
  return (
    <Link href={`/${locale}/admin/fakturor/${inv.id}`} className="flex items-center gap-4 rounded-2xl bg-[#1c1c1f] hover:bg-[#232327] px-5 py-4 transition">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold">#{inv.number}</span>
          <span className="font-semibold truncate">{inv.buyerName}</span>
          <InvoiceStatus inv={inv} />
        </div>
        <p className="text-sm text-white/50 mt-0.5">
          {periodLabel(inv.period)} · {inv.students} {inv.students === 1 ? 'elev' : 'elever'} ·{' '}
          {inv.creditOfId ? `kreditfaktura ${formatDate(inv.issueDate)}` : inv.status === 'paid' && inv.paidAt ? `betald ${formatDate(inv.paidAt)}` : inv.status === 'credited' ? 'krediterad' : `förfaller ${formatDate(inv.dueDate)}`}
        </p>
      </div>
      <span className="font-headline font-extrabold shrink-0">{kr(inv.total)}</span>
      <ChevronRight className="w-4 h-4 text-white/30 shrink-0" />
    </Link>
  );
}
