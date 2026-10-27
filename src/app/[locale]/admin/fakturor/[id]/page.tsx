'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import Link from 'next/link';
import { Download, Send } from 'lucide-react';
import AdminShell from '@/components/admin/AdminShell';
import { Button, Card, Field, Input, Textarea, formatDate } from '@/components/admin/ui';
import { InvoiceStatus, periodLabel } from '@/components/admin/invoice';

interface Line { id: number; date: string | null; description: string; quantity: number; unitPrice: number; amount: number; students: string }
interface Seller { name: string; address: string; orgNr: string; vatNr: string; bankgiro: string; plusgiro: string; iban: string; email: string; phone: string; paymentDays: number; fSkatt?: boolean }
interface Invoice {
  id: number; number: number; period: string; status: 'created' | 'sent' | 'paid' | 'credited';
  issueDate: string; dueDate: string; total: number; buyerName: string; buyerEmail: string; buyerOrgNr: string; buyerAddress: string;
  seller: Seller; sentAt: string | null; paidAt: string | null; creditOfId: number | null; creditedAt: string | null; lines: Line[];
}
interface Related { id: number; number: number; creditOfId: number | null }

// Belopp med ören – priserna är inkl. moms, så exkl. moms kan bli udda
const money = (n: number) => `${n.toLocaleString('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kr`;
const exVat = (n: number) => Math.round((n / 1.25) * 100) / 100;

export default function FakturaPage({ params }: { params: { id: string } }) {
  const locale = useLocale();
  const router = useRouter();
  const [inv, setInv] = useState<Invoice | null>(null);
  const [related, setRelated] = useState<Related[]>([]);
  const [info, setInfo] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [buyer, setBuyer] = useState({ orgNr: '', address: '' });

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/fakturor/${params.id}`);
    if (!res.ok) { setNotFound(true); return; }
    const { invoice, related } = await res.json();
    setInv(invoice);
    setRelated(related ?? []);
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

  const CONFIRM: Record<string, string> = {
    delete: 'Ta bort fakturan? Eleverna hamnar under "Att skicka" igen.',
    credit: 'Kreditera fakturan? En kreditfaktura skapas och eleverna hamnar under "Att skicka" igen, så att du kan fakturera dem rätt.',
  };

  const act = async (action: string) => {
    if (CONFIRM[action] && !confirm(CONFIRM[action])) return;
    if (action === 'send' && inv && !confirm(`Skicka ${inv.creditOfId ? 'kreditfakturan' : 'fakturan'} till ${inv.buyerEmail}?`)) return;
    setInfo('');
    setBusy(true);
    setError('');
    const res = await fetch(`/api/admin/fakturor/${params.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    const body = await res.json();
    setBusy(false);
    if (!res.ok) { setError(body.error ?? 'Något gick fel'); return; }
    if (action === 'delete') router.push(`/${locale}/admin/fakturor`);
    else if (action === 'credit') router.push(`/${locale}/admin/fakturor/${body.id}`);
    else {
      if (action === 'send') setInfo(`Skickad till ${inv?.buyerEmail}`);
      load();
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
  const credit = inv.creditOfId !== null;
  const original = related.find(r => r.id === inv.creditOfId);
  const creditNote = related.find(r => r.creditOfId === inv.id);
  const btn = 'inline-flex items-center justify-center gap-2 h-11 px-5 rounded-full text-sm font-semibold bg-white/10 text-white hover:bg-white/15 border border-white/10';
  const totalExVat = exVat(inv.total);
  const vat = Math.round((inv.total - totalExVat) * 100) / 100;

  return (
    <AdminShell
      title={`${credit ? 'Kreditfaktura' : 'Faktura'} #${inv.number}`}
      back={back}
      actions={<a href={`/api/admin/fakturor/${inv.id}/pdf?download`} className={btn}><Download className="w-4 h-4" /> <span className="hidden sm:inline">Ladda ner PDF</span></a>}
    >
      <div className="flex items-center gap-3 -mt-4 mb-6 text-sm text-white/60 flex-wrap">
        <InvoiceStatus inv={inv} />
        <span>{inv.buyerName} · {periodLabel(inv.period)}</span>
        {inv.sentAt && <span>· skickad {formatDate(inv.sentAt)}</span>}
        {inv.paidAt && <span>· betald {formatDate(inv.paidAt)}</span>}
        {original && <Link href={`/${locale}/admin/fakturor/${original.id}`} className="underline hover:text-white">· krediterar faktura #{original.number}</Link>}
        {creditNote && <Link href={`/${locale}/admin/fakturor/${creditNote.id}`} className="underline hover:text-white">· krediterad med #{creditNote.number}</Link>}
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
              <p className="font-headline text-3xl font-extrabold tracking-tight">{credit ? 'KREDITFAKTURA' : 'FAKTURA'}</p>
              <dl className="mt-2 grid grid-cols-[auto_auto] sm:justify-end gap-x-4 gap-y-0.5">
                <dt className="text-gray-500">{credit ? 'Kreditfakturanummer' : 'Fakturanummer'}</dt><dd className="font-semibold">{inv.number}</dd>
                <dt className="text-gray-500">Fakturadatum</dt><dd>{formatDate(inv.issueDate, { year: 'numeric', month: '2-digit', day: '2-digit' })}</dd>
                {credit ? (
                  <><dt className="text-gray-500">Krediterar faktura</dt><dd className="font-semibold">{original?.number ?? '–'}</dd></>
                ) : (
                  <><dt className="text-gray-500">Förfallodatum</dt><dd className="font-semibold">{formatDate(inv.dueDate, { year: 'numeric', month: '2-digit', day: '2-digit' })}</dd></>
                )}
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

          <p className="mt-6 text-gray-600">
            {credit ? `Kreditering av faktura ${original?.number ?? ''} – riskutbildning, kurser i ${periodLabel(inv.period).toLowerCase()}.` : `Riskutbildning för era elever – kurser i ${periodLabel(inv.period).toLowerCase()}.`}
          </p>

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
            <div className="flex justify-between border-t-2 border-gray-900 pt-2 mt-2 text-base font-bold"><span>{credit ? 'Att återbetala' : 'Att betala'}</span><span>{money(credit ? -inv.total : inv.total)}</span></div>
          </div>

          <div className="mt-8 grid sm:grid-cols-3 gap-4 border-t border-gray-200 pt-4 text-xs text-gray-600">
            <div>
              <p className="font-bold text-gray-900 mb-0.5">Betalning</p>
              {credit ? (
                <p>Beloppet dras av från kommande faktura eller betalas tillbaka.</p>
              ) : (
                <>
                  {s.bankgiro && <p>Bankgiro {s.bankgiro}</p>}
                  {s.plusgiro && <p>Plusgiro {s.plusgiro}</p>}
                  {s.iban && <p>IBAN {s.iban}</p>}
                  <p>Ange fakturanummer {inv.number} som referens</p>
                </>
              )}
            </div>
            <div>
              <p className="font-bold text-gray-900 mb-0.5">Villkor</p>
              {!credit && <p>{s.paymentDays} dagar netto</p>}
              {!credit && <p>Dröjsmålsränta enligt räntelagen</p>}
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
                    Kontrollera {credit ? 'kreditfakturan' : 'fakturan'} och skicka den. {inv.buyerEmail} får ett mejl med PDF:en, och en kopia går till er.
                  </p>
                  <Button variant="primary" className="w-full" disabled={busy} onClick={() => act('send')}><Send className="w-4 h-4" /> {busy ? 'Skickar…' : 'Skicka till skolan'}</Button>
                  <Button className="w-full" disabled={busy} onClick={() => act('sent')}>Markera som skickad utan mejl</Button>
                  {!credit && <Button variant="danger" className="w-full" disabled={busy} onClick={() => act('delete')}>Ta bort fakturan</Button>}
                </>
              )}
              {inv.status === 'sent' && !credit && (
                <Button variant="primary" className="w-full" disabled={busy} onClick={() => act('paid')}>Markera som betald</Button>
              )}
              {inv.status === 'paid' && (
                <Button className="w-full" disabled={busy} onClick={() => act('unpaid')}>Ångra betald</Button>
              )}
              {inv.status === 'sent' && (
                <Button className="w-full" disabled={busy} onClick={() => act('send')}><Send className="w-4 h-4" /> Skicka igen</Button>
              )}
              {!credit && (inv.status === 'sent' || inv.status === 'paid') && (
                <Button variant="danger" className="w-full" disabled={busy} onClick={() => act('credit')}>Kreditera</Button>
              )}
              {inv.status === 'credited' && (
                <p className="text-sm text-white/60">
                  Fakturan är krediterad{creditNote ? <> med <Link href={`/${locale}/admin/fakturor/${creditNote.id}`} className="underline">#{creditNote.number}</Link></> : ''}.
                  Eleverna kan faktureras på nytt under Att skicka.
                </p>
              )}
              {credit && inv.status === 'sent' && <p className="text-sm text-white/60">Kreditfakturan är skickad.</p>}
              {info && <p className="text-sm text-emerald-300">{info}</p>}
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
