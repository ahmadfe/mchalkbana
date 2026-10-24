'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { ChevronRight, Plus, Search } from 'lucide-react';
import clsx from 'clsx';
import AdminShell from '@/components/admin/AdminShell';
import { Badge, Select, formatDate } from '@/components/admin/ui';
import type { StudentDto } from '@/lib/students';

type Row = StudentDto & { filialName: string; lastCourseAt: string | null };
interface Filial { id: number; name: string }

export default function EleverPage() {
  const locale = useLocale();
  const [status, setStatus] = useState<'active' | 'archived'>('active');
  const [filialId, setFilialId] = useState('');
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<Row[] | null>(null);
  const [filialer, setFilialer] = useState<Filial[]>([]);

  useEffect(() => {
    fetch('/api/admin/filialer').then(r => r.json()).then(d => setFilialer(d.filialer ?? []));
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      const params = new URLSearchParams({ status, q, ...(filialId ? { filialId } : {}) });
      fetch(`/api/admin/students?${params}`, { signal: ctrl.signal })
        .then(r => r.json())
        .then(d => setRows(d.students ?? []))
        .catch(() => {});
    }, q ? 250 : 0);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [status, filialId, q]);

  return (
    <AdminShell
      title="Elever"
      actions={
        <Link href={`/${locale}/admin/elever/ny`} className="inline-flex items-center gap-1.5 h-11 px-5 rounded-full bg-white text-black text-sm font-semibold hover:bg-white/90">
          <Plus className="w-4 h-4" /> Ny elev
        </Link>
      }
    >
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="inline-flex p-1 rounded-2xl bg-[#1c1c1f] self-start">
          {(['active', 'archived'] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={clsx('px-4 py-2 rounded-xl text-sm font-semibold transition', status === s ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white')}
            >
              {s === 'active' ? 'Aktiva' : 'Arkiverade'}
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Sök på namn, personnummer, telefon eller e-post"
            className="w-full h-12 pl-11 pr-4 rounded-xl bg-[#1c1c1f] border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-white/40"
          />
        </div>
        {filialer.length > 1 && (
          <Select value={filialId} onChange={e => setFilialId(e.target.value)} className="sm:w-56 bg-[#1c1c1f]">
            <option value="">Alla filialer</option>
            {filialer.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </Select>
        )}
      </div>

      {rows === null ? (
        <div className="py-20 flex justify-center"><div className="w-6 h-6 border-2 border-white/50 border-t-transparent rounded-full animate-spin" /></div>
      ) : rows.length === 0 ? (
        <div className="rounded-3xl bg-[#1c1c1f] p-10 text-center text-white/50">
          {q ? 'Inga elever matchar sökningen.' : status === 'active' ? 'Inga aktiva elever än.' : 'Inga arkiverade elever.'}
        </div>
      ) : (
        <>
          <p className="text-sm text-white/40 mb-3">{rows.length} {rows.length === 1 ? 'elev' : 'elever'}</p>
          <div className="space-y-2">
            {rows.map(s => (
              <Link
                key={s.id}
                href={`/${locale}/admin/elever/${s.id}`}
                className="flex items-center gap-4 rounded-2xl bg-[#1c1c1f] hover:bg-[#232327] px-5 py-4 transition"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold truncate">{s.name || '(namn saknas)'}</span>
                    {s.risk1DoneAt && <Badge tone="green">Risk 1</Badge>}
                    {s.risk2DoneAt && <Badge tone="green">Risk 2</Badge>}
                  </div>
                  <p className="text-sm text-white/50 truncate mt-0.5">
                    {[s.personnummer, s.phone, s.email].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <div className="hidden sm:block text-right text-sm shrink-0">
                  <p className="text-white/70">{s.filialName || '–'}</p>
                  <p className="text-white/40">{s.lastCourseAt ? `Senaste kurs ${formatDate(s.lastCourseAt)}` : 'Ingen kurs'}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-white/30 shrink-0" />
              </Link>
            ))}
          </div>
        </>
      )}
    </AdminShell>
  );
}
