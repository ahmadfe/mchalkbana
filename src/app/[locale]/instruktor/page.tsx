'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { CheckCircle2, ChevronRight, Send } from 'lucide-react';
import clsx from 'clsx';
import InstructorShell from '@/components/InstructorShell';
import KindBadge from '@/components/admin/KindBadge';
import { useAuth } from '@/context/AuthContext';

interface TodayCourse {
  id: number; startTime: string; endTime: string; resultsSentAt: string | null;
  title: string; type: string; behorighet: string;
  students: number; checkedIn: number; assessed: number;
}

const tz = { timeZone: 'Europe/Stockholm' } as const;
const hm = (iso: string) => new Date(iso).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', ...tz });

/** Lärarens startsida: dagens kurser – hur många som är incheckade och bedömda. */
export default function InstruktorPage() {
  const locale = useLocale();
  const { user } = useAuth();
  const [courses, setCourses] = useState<TodayCourse[] | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => fetch('/api/instructor/sessions/today').then(r => r.json()).then(d => setCourses(d.sessions ?? [])), []);
  useEffect(() => { if (user?.role === 'instructor') load(); }, [user, load]);

  const sendAll = async () => {
    if (!confirm('Skicka resultaten för alla dagens kurser? De mejlas till kontoret som rapport.')) return;
    setSending(true);
    setError('');
    const res = await fetch('/api/instructor/sessions/approve-all', { method: 'POST' });
    setSending(false);
    if (!res.ok) { setError('Kunde inte skicka. Försök igen.'); return; }
    load();
  };

  const today = new Date().toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long', ...tz });
  const unsent = (courses ?? []).filter(c => !c.resultsSentAt && c.students > 0);

  return (
    <InstructorShell>
      <p className="text-sm font-semibold text-white/50 capitalize">{today}</p>
      <h1 className="font-headline text-3xl sm:text-4xl font-extrabold tracking-tight mt-1 mb-6">Idag</h1>

      {courses === null ? (
        <div className="py-16 flex justify-center"><div className="w-6 h-6 border-2 border-white/50 border-t-transparent rounded-full animate-spin" /></div>
      ) : courses.length === 0 ? (
        <div className="rounded-3xl bg-[#1c1c1f] p-10 text-center">
          <p className="font-semibold">Inga kurser i dag</p>
          <p className="text-sm text-white/50 mt-1">Dina kurser visas här den dag de hålls.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {courses.map(c => {
            const allIn = c.students > 0 && c.checkedIn === c.students;
            const allAssessed = c.students > 0 && c.assessed === c.students;
            return (
              <Link key={c.id} href={`/${locale}/instruktor/session/${c.id}`} className="rounded-3xl bg-[#1c1c1f] hover:bg-[#232327] active:bg-[#26262a] p-5 transition block">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2"><KindBadge type={c.type} /><span className="text-xs text-white/50">{c.behorighet}</span></div>
                    <p className="font-headline text-xl font-extrabold mt-1.5 leading-tight">{c.title}</p>
                    <p className="text-white/70 mt-1">{hm(c.startTime)}–{hm(c.endTime)}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-white/30 shrink-0 mt-1" />
                </div>

                <div className="grid grid-cols-2 gap-3 mt-5">
                  <Progress label="Incheckade" value={c.checkedIn} max={c.students} done={allIn} />
                  <Progress label="Bedömda" value={c.assessed} max={c.students} done={allAssessed} />
                </div>

                {c.resultsSentAt ? (
                  <p className="flex items-center gap-1.5 text-sm text-emerald-300 mt-4"><CheckCircle2 className="w-4 h-4" /> Resultat skickat {hm(c.resultsSentAt)}</p>
                ) : c.students - c.assessed > 0 ? (
                  <p className="text-sm text-amber-300 mt-4">{c.students - c.assessed} ej bedömd{c.students - c.assessed === 1 ? '' : 'a'}</p>
                ) : null}
              </Link>
            );
          })}
        </div>
      )}

      {unsent.length > 1 && (
        <div className="fixed inset-x-0 bottom-0 z-20 bg-[#0b0b0d]/95 backdrop-blur border-t border-white/10 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <div className="max-w-5xl mx-auto sm:px-2">
            {error && <p className="text-sm text-red-400 mb-2">{error}</p>}
            <button
              onClick={sendAll}
              disabled={sending}
              className="w-full h-14 rounded-2xl bg-white text-black font-bold text-base flex items-center justify-center gap-2 active:scale-[0.99] disabled:opacity-60"
            >
              <Send className="w-5 h-5" /> {sending ? 'Skickar…' : `Skicka resultat för alla ${unsent.length} kurser`}
            </button>
          </div>
        </div>
      )}
    </InstructorShell>
  );
}

function Progress({ label, value, max, done }: { label: string; value: number; max: number; done: boolean }) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-xs text-white/50">{label}</span>
        <span className={clsx('font-headline text-lg font-extrabold', done ? 'text-emerald-300' : 'text-white')}>{value}<span className="text-white/40 text-sm font-semibold"> av {max}</span></span>
      </div>
      <div className="h-2 rounded-full bg-white/10 overflow-hidden mt-1.5">
        <div className={clsx('h-full rounded-full', done ? 'bg-emerald-400' : 'bg-sky-400')} style={{ width: `${max ? Math.min(100, (value / max) * 100) : 0}%` }} />
      </div>
    </div>
  );
}
