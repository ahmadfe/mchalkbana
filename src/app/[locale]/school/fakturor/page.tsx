'use client';

import { BarChart2, Download, FileText } from 'lucide-react';
import { SchoolPage, useSchool } from '@/components/school/SchoolShell';
import { dateLabel, invoiceStatus, kr, monthLabel, tz, unpaidInvoices } from '@/components/school/shared';
import { Badge, Card } from '@/components/admin/ui';

export default function SchoolInvoicesPage() {
  const { invoices, bookings } = useSchool();
  const unpaid = unpaidInvoices(invoices);
  const toPay = unpaid.reduce((s, i) => s + i.total, 0);
  const overdue = unpaid.filter(i => new Date(i.dueDate) < new Date());

  // Elever per månad (efter kursdatum)
  const buckets: Record<string, number> = {};
  for (const b of bookings) {
    const key = new Date(b.session.startTime).toLocaleDateString('sv-SE', { year: 'numeric', month: '2-digit', ...tz }).slice(0, 7);
    buckets[key] = (buckets[key] || 0) + 1;
  }
  const months = Object.entries(buckets).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 12);
  const max = Math.max(1, ...months.map(([, v]) => v));

  return (
    <SchoolPage title="Fakturor" subtitle="Ni faktureras den 26:e varje månad för månadens elever">
      {unpaid.length > 0 && (
        <div className={`rounded-3xl p-5 flex items-center gap-4 ${overdue.length ? 'bg-red-500/10' : 'bg-amber-500/10'}`}>
          <div className="min-w-0 flex-1">
            <p className={`text-sm font-semibold ${overdue.length ? 'text-red-300' : 'text-amber-300'}`}>
              {overdue.length ? `${overdue.length} förfallen faktura${overdue.length === 1 ? '' : 'or'}` : `${unpaid.length} obetald faktura${unpaid.length === 1 ? '' : 'or'}`}
            </p>
            <p className="text-sm text-white/60 mt-0.5">Betala till bankgirot som står på fakturan. Kontakta oss om något inte stämmer.</p>
          </div>
          <p className="font-headline text-2xl sm:text-3xl font-extrabold shrink-0">{kr(toPay)}</p>
        </div>
      )}

      <Card title="Alla fakturor">
        {invoices.length === 0 ? (
          <div className="text-center py-10">
            <FileText className="w-9 h-9 mx-auto mb-3 text-white/25" strokeWidth={1.5} />
            <p className="font-semibold">Inga fakturor än</p>
            <p className="text-sm text-white/50 mt-1">Fakturorna visas här när de har skickats.</p>
          </div>
        ) : (
          <ul className="divide-y divide-white/5 -my-2">
            {invoices.map(i => {
              const s = invoiceStatus(i);
              return (
                <li key={i.id} className="flex items-center gap-3 py-3.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{i.creditOfId ? 'Kreditfaktura' : 'Faktura'} {i.number}</span>
                      <Badge tone={s.tone}>{s.label}</Badge>
                    </div>
                    <p className="text-sm text-white/50 mt-0.5">
                      Kurser i {monthLabel(i.period)} · {i.creditOfId || i.status !== 'sent' ? dateLabel(i.issueDate) : `betala senast ${dateLabel(i.dueDate)}`}
                    </p>
                  </div>
                  <span className="font-bold shrink-0">{i.total < 0 ? '−' : ''}{kr(Math.abs(i.total))}</span>
                  <a
                    href={`/api/school/fakturor/${i.id}/pdf`}
                    aria-label={`Ladda ner faktura ${i.number}`}
                    title="Ladda ner PDF"
                    className="w-10 h-10 rounded-full bg-white/10 text-white/80 hover:bg-white/15 flex items-center justify-center shrink-0"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card title="Elever per månad" aside={<BarChart2 className="w-4 h-4 text-white/40" />}>
        {months.length === 0 ? (
          <p className="text-sm text-white/40 py-4 text-center">Inga bokningar ännu.</p>
        ) : (
          <ul className="space-y-3">
            {months.map(([month, count]) => (
              <li key={month} className="grid grid-cols-[8rem_2rem_1fr] items-center gap-3 text-sm">
                <span className="capitalize text-white/80">{monthLabel(month)}</span>
                <span className="font-bold text-right">{count}</span>
                <span className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <span className="block h-full bg-sky-400 rounded-full" style={{ width: `${Math.round((count / max) * 100)}%` }} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </SchoolPage>
  );
}
