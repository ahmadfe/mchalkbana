'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { ChevronRight, Plus, X } from 'lucide-react';
import clsx from 'clsx';
import AdminShell from '@/components/admin/AdminShell';
import { Button, Checkbox, Field, Input, formatDate } from '@/components/admin/ui';
import { kr } from '@/components/admin/invoice';

interface Batch {
  id: number; name: string; label: string; validTo: string | null; courses: string[]; createdBy: string; createdAt: string;
  total: number; used: number; available: number; discountTotal: number;
}
interface Course { id: number; title: string }

export default function RabattkoderPage() {
  const locale = useLocale();
  const router = useRouter();
  const [data, setData] = useState<{ batches: Batch[]; courses: Course[] } | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => fetch('/api/admin/rabattkoder').then(r => r.json()).then(setData), []);
  useEffect(() => { load(); }, [load]);

  return (
    <AdminShell title="Rabattkoder" actions={<Button variant="primary" onClick={() => setCreating(true)}><Plus className="w-4 h-4" /> <span className="hidden sm:inline">Skapa koder</span></Button>}>
      <p className="text-sm text-white/60 -mt-4 mb-6">Varje kod kan användas en gång i kassan. Skapa en omgång, t.ex. 20 koder till en partner, och dela ut dem.</p>

      {data === null ? (
        <div className="py-20 flex justify-center"><div className="w-6 h-6 border-2 border-white/50 border-t-transparent rounded-full animate-spin" /></div>
      ) : data.batches.length === 0 ? (
        <div className="rounded-3xl bg-[#1c1c1f] p-10 text-center">
          <p className="text-white/60 mb-4">Inga rabattkoder än.</p>
          <Button variant="primary" onClick={() => setCreating(true)}><Plus className="w-4 h-4" /> Skapa koder</Button>
        </div>
      ) : (
        <div className="space-y-2">
          {data.batches.map(b => {
            const expired = b.validTo && new Date(b.validTo) <= new Date();
            return (
              <Link key={b.id} href={`/${locale}/admin/rabattkoder/${b.id}`} className="flex items-center gap-4 rounded-2xl bg-[#1c1c1f] hover:bg-[#232327] px-4 sm:px-5 py-4 transition">
                <span className="w-16 h-16 rounded-2xl bg-emerald-500/15 text-emerald-300 font-headline font-extrabold flex items-center justify-center shrink-0 text-center leading-tight text-sm px-1">−{b.label}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold truncate">{b.name}</p>
                  <p className="text-sm text-white/55">
                    {b.used} av {b.total} använda · {b.available} kvar
                    {b.discountTotal > 0 && ` · ${kr(b.discountTotal)} i rabatt`}
                  </p>
                  <p className={clsx('text-xs mt-0.5', expired ? 'text-red-300' : 'text-white/35')}>
                    {b.validTo ? `${expired ? 'Gick ut' : 'Gäller t.o.m.'} ${formatDate(new Date(new Date(b.validTo).getTime() - 1).toISOString())}` : 'Ingen slutdag'}
                    {' · '}{b.courses.length ? b.courses.join(', ') : 'Alla kurser'}
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-white/30 shrink-0" />
              </Link>
            );
          })}
        </div>
      )}

      {creating && data && (
        <CreateSheet
          courses={data.courses}
          onClose={() => setCreating(false)}
          onCreated={id => router.push(`/${locale}/admin/rabattkoder/${id}`)}
        />
      )}
    </AdminShell>
  );
}

function CreateSheet({ courses, onClose, onCreated }: { courses: Course[]; onClose: () => void; onCreated: (id: number) => void }) {
  const [f, setF] = useState({ name: '', kind: 'percent' as 'percent' | 'amount', value: '', count: '10', validTo: '' });
  const [allCourses, setAllCourses] = useState(true);
  const [courseIds, setCourseIds] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    setBusy(true);
    setError('');
    const res = await fetch('/api/admin/rabattkoder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...f, value: Number(f.value), count: Number(f.count), validTo: f.validTo || null, courseIds: allCourses ? [] : courseIds }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) { setError(data.error ?? 'Något gick fel'); return; }
    onCreated(data.id);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Skapa rabattkoder"
        onClick={e => e.stopPropagation()}
        className="sheet bg-[#1c1c1f] text-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md max-h-[92dvh] overflow-y-auto p-5 sm:p-6 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-6"
      >
        <div className="flex items-start justify-between gap-3 mb-5 pt-2 sm:pt-0">
          <h3 className="font-headline text-xl font-extrabold">Skapa rabattkoder</h3>
          <button onClick={onClose} aria-label="Stäng" className="w-10 h-10 -mr-2 rounded-full hover:bg-white/10 flex items-center justify-center shrink-0"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-4">
          <Field label="Namn på omgången" required hint="Syns bara för er, t.ex. Partner X eller Julkampanj">
            <Input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} autoComplete="off" />
          </Field>
          <Field label="Rabatt" required>
            <div className="flex gap-2">
              <Input inputMode="numeric" value={f.value} onChange={e => setF({ ...f, value: e.target.value.replace(/\D/g, '') })} placeholder={f.kind === 'percent' ? '10' : '200'} />
              <div className="flex p-1 rounded-xl bg-[#26262a] shrink-0">
                {(['percent', 'amount'] as const).map(k => (
                  <button key={k} type="button" onClick={() => setF({ ...f, kind: k })} className={clsx('h-9 px-4 rounded-lg text-sm font-semibold', f.kind === k ? 'bg-white/15 text-white' : 'text-white/50')}>
                    {k === 'percent' ? '%' : 'kr'}
                  </button>
                ))}
              </div>
            </div>
          </Field>
          <Field label="Antal koder" required hint="Varje kod kan användas en gång (högst 500)">
            <Input inputMode="numeric" value={f.count} onChange={e => setF({ ...f, count: e.target.value.replace(/\D/g, '') })} />
          </Field>
          <Field label="Gäller till och med" hint="Lämna tomt om koderna inte ska gå ut">
            <Input type="date" value={f.validTo} onChange={e => setF({ ...f, validTo: e.target.value })} className="[color-scheme:dark]" />
          </Field>
          <Field label="Gäller för">
            <div className="space-y-2">
              <Checkbox checked={allCourses} onChange={setAllCourses}>Alla kurser</Checkbox>
              {!allCourses && courses.map(c => (
                <Checkbox key={c.id} checked={courseIds.includes(c.id)} onChange={v => setCourseIds(v ? [...courseIds, c.id] : courseIds.filter(x => x !== c.id))}>{c.title}</Checkbox>
              ))}
            </div>
          </Field>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex gap-3">
            <Button onClick={onClose}>Avbryt</Button>
            <Button
              variant="primary"
              className="flex-1"
              disabled={busy || !f.name.trim() || !f.value || !f.count || (!allCourses && courseIds.length === 0)}
              onClick={save}
            >
              {busy ? 'Skapar…' : `Skapa ${f.count || 0} kod${f.count === '1' ? '' : 'er'}`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
