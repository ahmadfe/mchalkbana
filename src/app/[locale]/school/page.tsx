'use client';

import Link from 'next/link';
import { useLocale } from 'next-intl';
import { Calendar, ChevronRight, Download, FileText, Receipt, Users, UserCheck } from 'lucide-react';
import clsx from 'clsx';
import { SchoolPage, StatCard, useSchool } from '@/components/school/SchoolShell';
import { buildPasses, dateLabel, hm, invoiceStatus, KIND, kr, monthLabel, tz, unpaidInvoices } from '@/components/school/shared';
import { Badge, Card } from '@/components/admin/ui';
import { courseKind } from '@/lib/courseKind';
import { useAuth } from '@/context/AuthContext';

export default function SchoolOverviewPage() {
  const locale = useLocale();
  const { user } = useAuth();
  const { sessions, bookings, priceMap, invoices } = useSchool();
  const { upcoming } = buildPasses(sessions, bookings, priceMap, locale);

  const now = new Date();
  const comingStudents = bookings.filter(b => new Date(b.session.startTime) > now).length;
  const ym = (d: Date) => d.toLocaleDateString('sv-SE', { year: 'numeric', month: '2-digit', ...tz });
  const thisMonth = bookings.filter(b => ym(new Date(b.session.startTime)) === ym(now)).length;
  const unpaid = unpaidInvoices(invoices);
  const toPay = unpaid.reduce((s, i) => s + i.total, 0);
  const overdue = unpaid.some(i => new Date(i.dueDate) < now);

  // Nästa pass: först de där skolan har elever eller platser
  const next = [...upcoming].sort((a, b) => a.start.getTime() - b.start.getTime()).slice(0, 4);
  const latest = invoices[0];

  return (
    <SchoolPage title={user?.name ?? 'Översikt'} subtitle="Trafikskolekonto · faktureras den 26:e varje månad">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard icon={Calendar} value={upcoming.length} label="Tillgängliga pass" tone="text-sky-300" href="/school/pass" />
        <StatCard icon={Users} value={comingStudents} label="Kommande elever" tone="text-emerald-300" href="/school/elever" />
        <StatCard icon={UserCheck} value={thisMonth} label={`Elever i ${now.toLocaleDateString('sv-SE', { month: 'long', ...tz })}`} tone="text-purple-300" href="/school/elever" />
        <StatCard icon={Receipt} value={kr(toPay)} label={overdue ? 'Att betala – förfallen' : 'Att betala'} tone={overdue ? 'text-red-300' : toPay > 0 ? 'text-amber-300' : 'text-white/60'} href="/school/fakturor" />
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-5 items-start">
        <Card title="Nästa pass" aside={<Link href={`/${locale}/school/pass`} className="text-sm text-white/60 hover:text-white inline-flex items-center gap-1">Alla pass <ChevronRight className="w-4 h-4" /></Link>}>
          {next.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="w-9 h-9 mx-auto mb-3 text-white/25" strokeWidth={1.5} />
              <p className="font-semibold">Inga tillgängliga pass</p>
              <p className="text-sm text-white/50 mt-1">Kontakta oss för att få platser på ett pass.</p>
            </div>
          ) : (
            <ul className="-my-1">
              {next.map(item => {
                const kind = KIND[courseKind(item.session.course?.type ?? '')];
                return (
                  <li key={item.id}>
                    <Link href={`/${locale}/school/pass?id=${item.id}`} className="flex items-center gap-3 py-3 -mx-2 px-2 rounded-xl hover:bg-white/5">
                      <div className="w-12 shrink-0 text-center rounded-xl bg-white/5 py-1.5">
                        <p className="text-[11px] font-semibold uppercase text-white/50 leading-none">{item.start.toLocaleDateString('sv-SE', { month: 'short', ...tz }).replace('.', '')}</p>
                        <p className="font-headline text-xl font-extrabold leading-tight">{item.start.toLocaleDateString('sv-SE', { day: 'numeric', ...tz })}</p>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={clsx('text-[11px] font-bold px-1.5 py-0.5 rounded-md shrink-0', kind.cls)}>{kind.label}</span>
                          <p className="font-semibold truncate">{item.title}</p>
                        </div>
                        <p className="text-sm text-white/50 mt-0.5">
                          {item.start.toLocaleDateString('sv-SE', { weekday: 'short', ...tz })} {hm(item.start)}–{hm(item.end)}
                        </p>
                      </div>
                      <span className={clsx('text-xs font-semibold shrink-0 text-right', item.locked ? 'text-red-400' : 'text-emerald-400')}>
                        {item.myAllocation !== null ? `${item.students.length}/${item.myAllocation}` : `${item.students.length} elev${item.students.length === 1 ? '' : 'er'}`}
                        <span className="block text-white/40 font-normal">{item.deadlinePassed ? 'stängt' : item.full ? 'fullt' : item.myAllocation !== null ? 'platser' : `${item.session.seatsAvailable} lediga`}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card title="Senaste faktura" aside={<Link href={`/${locale}/school/fakturor`} className="text-sm text-white/60 hover:text-white inline-flex items-center gap-1">Alla <ChevronRight className="w-4 h-4" /></Link>}>
          {!latest ? (
            <div className="text-center py-8">
              <FileText className="w-9 h-9 mx-auto mb-3 text-white/25" strokeWidth={1.5} />
              <p className="text-sm text-white/50">Inga fakturor än. Ni faktureras den 26:e varje månad för månadens elever.</p>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold">{latest.creditOfId ? 'Kreditfaktura' : 'Faktura'} {latest.number}</span>
                <Badge tone={invoiceStatus(latest).tone}>{invoiceStatus(latest).label}</Badge>
              </div>
              <p className="text-sm text-white/50 mt-1 capitalize">Kurser i {monthLabel(latest.period)}</p>
              <p className="font-headline text-3xl font-extrabold mt-4">{kr(Math.abs(latest.total))}</p>
              <p className="text-sm text-white/50 mt-1">
                {latest.status === 'sent' && !latest.creditOfId ? `Betala senast ${dateLabel(latest.dueDate)}` : `Datum ${dateLabel(latest.issueDate)}`}
              </p>
              <a href={`/api/school/fakturor/${latest.id}/pdf`} className="mt-5 w-full h-11 rounded-full bg-white/10 border border-white/10 hover:bg-white/15 text-sm font-semibold inline-flex items-center justify-center gap-2">
                <Download className="w-4 h-4" /> Ladda ner PDF
              </a>
            </div>
          )}
        </Card>
      </div>
    </SchoolPage>
  );
}
