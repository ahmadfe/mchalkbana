'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { ChevronRight, Search } from 'lucide-react';
import AdminShell from '@/components/admin/AdminShell';
import { Badge } from '@/components/admin/ui';

interface Row {
  id: number; name: string; email: string; phone: string | null;
  upcomingCourses: number; studentsThisMonth: number;
  invoicesToSend: number; invoicesUnpaid: number; invoicesOverdue: number;
}

export default function TrafikskolorPage() {
  const locale = useLocale();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    fetch('/api/admin/trafikskolor').then(r => r.json()).then(d => setRows(d.schools ?? []));
  }, []);

  const shown = (rows ?? []).filter(r => !q || `${r.name} ${r.email}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <AdminShell
      title="Trafikskolor"
      actions={
        // Kontona flyttar till Personal i nästa steg – tills dess skapas de på den gamla sidan
        <Link href={`/${locale}/admin?tab=schools`} className="inline-flex items-center h-11 px-5 rounded-full bg-white/10 border border-white/10 text-sm font-semibold hover:bg-white/15">
          Skapa konto
        </Link>
      }
    >
      <div className="relative mb-5 sm:max-w-md">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Sök trafikskola"
          className="w-full h-12 pl-11 pr-4 rounded-xl bg-[#1c1c1f] border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-white/40"
        />
      </div>

      {rows === null ? (
        <div className="py-20 flex justify-center"><div className="w-6 h-6 border-2 border-white/50 border-t-transparent rounded-full animate-spin" /></div>
      ) : shown.length === 0 ? (
        <div className="rounded-3xl bg-[#1c1c1f] p-10 text-center text-white/50">{q ? 'Ingen trafikskola matchar sökningen.' : 'Inga trafikskolor än.'}</div>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {shown.map(r => (
            <Link key={r.id} href={`/${locale}/admin/trafikskolor/${r.id}`} className="rounded-2xl bg-[#1c1c1f] hover:bg-[#232327] p-5 transition flex flex-col">
              <div className="flex items-start gap-3">
                <span className="w-10 h-10 rounded-xl bg-white/10 text-sm font-bold flex items-center justify-center shrink-0">
                  {r.name.split(/\s+/).filter(w => /^\p{L}/u.test(w)).slice(0, 2).map(w => w[0].toUpperCase()).join('')}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold truncate">{r.name}</p>
                  <p className="text-sm text-white/50 truncate">{r.email}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-white/30 shrink-0 mt-1" />
              </div>
              <div className="grid grid-cols-2 gap-3 mt-4">
                <div>
                  <p className="font-headline text-2xl font-extrabold">{r.upcomingCourses}</p>
                  <p className="text-xs text-white/50">kommande kurser</p>
                </div>
                <div>
                  <p className="font-headline text-2xl font-extrabold">{r.studentsThisMonth}</p>
                  <p className="text-xs text-white/50">elever denna månad</p>
                </div>
              </div>
              {(r.invoicesToSend > 0 || r.invoicesUnpaid > 0) && (
                <div className="flex flex-wrap gap-1.5 mt-4">
                  {r.invoicesToSend > 0 && <Badge tone="blue">{r.invoicesToSend} att fakturera</Badge>}
                  {r.invoicesOverdue > 0 ? <Badge tone="red">{r.invoicesOverdue} förfallen</Badge> : r.invoicesUnpaid > 0 && <Badge tone="amber">{r.invoicesUnpaid} obetald</Badge>}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </AdminShell>
  );
}
