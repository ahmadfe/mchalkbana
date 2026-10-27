'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { Printer } from 'lucide-react';
import AdminShell from '@/components/admin/AdminShell';
import { Button, Card, Field, Input, Textarea, formatDate } from '@/components/admin/ui';
import { InvoiceStatus, periodLabel } from '@/components/admin/invoice';

interface Line { id: number; date: string | null; description: string; quantity: number; unitPrice: number; amount: number; students: string }
interface Seller { name: string; address: string; orgNr: string; vatNr: string; bankgiro: string; plusgiro: string; iban: string; email: string; phone: string; paymentDays: number; fSkatt?: boolean }
interface Invoice {
  id: number; number: number; period: string; status: 'created' | 'sent' | 'paid' | 'credited';
  issueDate: string; dueDate: string; total: number; buyerName: string; buyerEmail: string; buyerOrgNr: string; buyerAddress: string;
  seller: Seller; sentAt: string | null; paidAt: string | null; lines: Line[];
}

// Belopp med ören – priserna är inkl. moms, så exkl. moms kan bli udda
const money = (n: number) => `${n.toLocaleString('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kr`;
const exVat = (n: number) => Math.round((n / 1.25) * 100) / 100;

export default function FakturaPage({ params }: { params: { id: string } }) {
  const locale = useLocale();
  const router = useRouter();
  const [inv, setInv] = useState<Invoice | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [buyer, setBuyer] = useState({ orgNr: '', address: '' });

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/fakturor/${params.id}`);
    if (!res.ok) { setNotFound(true); return; }
    const { invoice } = await res.json();
    setInv(invoice);
    setBuyer({ orgNr: invoice.buyerOrgNr, address: invoice.buyerAddress });
  }, [params.id]);
  useEffect(() => { load(); }, [load]);

  const patch = async (body: Record<string, unknown>) => {
    setBusy(true);
    setError('');
    const res = await fetch(`/api/admin/fakturor/${params.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!res.ok) { setError((await res.json()).error ?? 'Något gick fel'); return false; }
    return true;
  };

  const act = async (action: string) => {
    if (action === 'delete' && !confirm('Ta bort fakturan? Eleverna hamnar under "Att skicka" igen.')) return;
    if (await patch({ action })) {
      if (action === 'delete') router.push(`/${locale}/admin/fakturor`);
      else load();
    }
  };

  const back = { href: '/admin/fakturor', label: 'Fakturor' };
  if (notFound) return <AdminShell title="Fakturan hittades inte" back={back}><p className="text-white/60">Den kan ha tagits bort.</p></AdminShell>;
  if (!inv) {
    return (
      <AdminShell title="Faktura" back={back}>
        <div className="py-20 flex justify-center"><div className="w-6 h-6 border-2 border-white/50 border-t-transparent rounded-full animate-spin" /></div>
      </AdminShell>
    );
  }

  const s = inv.seller;
  const totalExVat = exVat(inv.total);
  const vat = Math.round((inv.total - totalExVat) * 100) / 100;

  return (
    <AdminShell
      title={`Faktura #${inv.number}`}
      back={back}
      actions={<Button onClick={() => window.print()}><Printer className="w-4 h-4" /> <span className="hidden sm:inline">Skriv ut / PDF</span></Button>}
    >
      <div className="flex items-center gap-3 -mt-4 mb-6 text-sm text-white/60 flex-wrap">
        <InvoiceStatus inv={inv} />
        <span>{inv.buyerName} · {periodLabel(inv.period)}</span>
        {inv.sentAt && <span>· skickad {formatDate(inv.sentAt)}</span>}
        {inv.paidAt && <span>· betald {formatDate(inv.paidAt)}</span>}
      </div>

      <div className="grid xl:grid-cols-[minmax(0,1fr)_320px] gap-5 items-start">
        {/* Själva fakturan – det här är det som skrivs ut */}
        <div className="invoice-paper bg-white text-gray-900 rounded-3xl p-6 sm:p-10 text-sm overflow-x-auto">
          <div className="flex flex-col sm:flex-row sm:justify-between gap-6">
            <div>
              <p className="font-headline text-2xl font-extrabold">{s.name}</p>
              <p className="text-gray-600 whitespace-pre-line mt-1">{s.address}</p>
              <p className="text-gray-600">{[s.email, s.phone].filter(Boolean).join(' · ')}</p>
            </div>
            <div className="sm:text-right">
              <p className="font-headline text-3xl font-extrabold tracking-tight">FAKTURA</p>
              <dl className="mt-2 grid grid-cols-[auto_auto] sm:justify-end gap-x-4 gap-y-0.5">
                <dt className="text-gray-500">Fakturanummer</dt><dd className="font-semibold">{inv.number}</dd>
                <dt className="text-gray-500">Fakturadatum</dt><dd>{formatDate(inv.issueDate, { year: 'numeric', month: '2-digit', day: '2-digit' })}</dd>
                <dt className="text-gray-500">Förfallodatum</dt><dd className="font-semibold">{formatDate(inv.dueDate, { year: 'numeric', month: '2-digit', day: '2-digit' })}</dd>
              </dl>
            </div>
          </div>

          <div className="mt-8 rounded-2xl bg-gray-50 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-gray-400 mb-1">Faktureras till</p>
            <p className="font-semibold">{inv.buyerName}</p>
            {inv.buyerAddress && <p className="text-gray-600 whitespace-pre-line">{inv.buyerAddress}</p>}
            {inv.buyerOrgNr && <p className="text-gray-600">Org.nr {inv.buyerOrgNr}</p>}
            <p className="text-gray-600">{inv.buyerEmail}</p>
          </div>

          <p className="mt-6 text-gray-600">Riskutbildning för era elever – kurser i {periodLabel(inv.period).toLowerCase()}.</p>

          <table className="w-full mt-3 min-w-[480px]">
            <thead>
              <tr className="border-b-2 border-gray-900 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="py-2 pr-3">Datum</th>
                <th className="py-2 pr-3">Beskrivning</th>
                <th className="py-2 pr-3 text-right">Antal</th>
                <th className="py-2 pr-3 text-right">À-pris exkl. moms</th>
                <th className="py-2 text-right">Belopp exkl. moms</th>
              </tr>
            </thead>
            <tbody>
              {inv.lines.map(l => (
                <tr key={l.id} className="border-b border-gray-100 align-top">
                  <td className="py-2.5 pr-3 whitespace-nowrap">{l.date ? formatDate(l.date, { year: 'numeric', month: '2-digit', day: '2-digit' }) : ''}</td>
                  <td className="py-2.5 pr-3">
                    <p className="font-medium">{l.description}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{l.students.split('\n').join(', ')}</p>
                  </td>
                  <td className="py-2.5 pr-3 text-right">{l.quantity}</td>
                  <td className="py-2.5 pr-3 text-right whitespace-nowrap">{money(exVat(l.unitPrice))}</td>
                  <td className="py-2.5 text-right whitespace-nowrap">{money(exVat(l.amount))}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-4 ml-auto w-full sm:w-72 space-y-1">
            <div className="flex justify-between"><span className="text-gray-500">Summa exkl. moms</span><span>{money(totalExVat)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Moms 25 %</span><span>{money(vat)}</span></div>
            <div className="flex justify-between border-t-2 border-gray-900 pt-2 mt-2 text-base font-bold"><span>Att betala</span><span>{money(inv.total)}</span></div>
          </div>

          <div className="mt-8 grid sm:grid-cols-3 gap-4 border-t border-gray-200 pt-4 text-xs text-gray-600">
            <div>
              <p className="font-bold text-gray-900 mb-0.5">Betalning</p>
              {s.bankgiro && <p>Bankgiro {s.bankgiro}</p>}
              {s.plusgiro && <p>Plusgiro {s.plusgiro}</p>}
              {s.iban && <p>IBAN {s.iban}</p>}
              <p>Ange fakturanummer {inv.number} som referens</p>
            </div>
            <div>
              <p className="font-bold text-gray-900 mb-0.5">Villkor</p>
              <p>{s.paymentDays} dagar netto</p>
              <p>Dröjsmålsränta enligt räntelagen</p>
            </div>
            <div>
              <p className="font-bold text-gray-900 mb-0.5">{s.name}</p>
              {s.orgNr && <p>Org.nr {s.orgNr}</p>}
              {s.vatNr && <p>Momsreg.nr {s.vatNr}</p>}
              {s.fSkatt !== false && <p>Godkänd för F-skatt</p>}
            </div>
          </div>
        </div>

        {/* Åtgärder */}
        <div className="space-y-4 print:hidden">
          <Card title="Status">
            <div className="space-y-2">
              {inv.status === 'created' && (
                <>
                  <p className="text-sm text-white/60 mb-3">
                    Kontrollera fakturan och skicka den till {inv.buyerEmail}. Utskick med PDF direkt härifrån kommer i nästa steg –
                    tills dess: skriv ut / spara som PDF och mejla den, och markera den sedan som skickad.
                  </p>
                  <Button variant="primary" className="w-full" disabled={busy} onClick={() => act('sent')}>Markera som skickad</Button>
                  <Button variant="danger" className="w-full" disabled={busy} onClick={() => act('delete')}>Ta bort fakturan</Button>
                </>
              )}
              {inv.status === 'sent' && (
                <Button variant="primary" className="w-full" disabled={busy} onClick={() => act('paid')}>Markera som betald</Button>
              )}
              {inv.status === 'paid' && (
                <Button className="w-full" disabled={busy} onClick={() => act('unpaid')}>Ångra betald</Button>
              )}
              {error && <p className="text-sm text-red-400">{error}</p>}
            </div>
          </Card>

          {inv.status === 'created' && (
            <Card title="Köparens uppgifter">
              <div className="space-y-3">
                <Field label="Organisationsnummer"><Input value={buyer.orgNr} onChange={e => setBuyer({ ...buyer, orgNr: e.target.value })} placeholder="556677-8899" /></Field>
                <Field label="Fakturaadress"><Textarea value={buyer.address} onChange={e => setBuyer({ ...buyer, address: e.target.value })} placeholder={'Gatan 1\n123 45 Ort'} /></Field>
                <Button className="w-full" disabled={busy} onClick={async () => { if (await patch({ action: 'buyer', ...buyer })) load(); }}>Spara</Button>
                <p className="text-xs text-white/40">Sparas också på trafikskolan till nästa faktura.</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </AdminShell>
  );
}
