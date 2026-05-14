'use client';

import { useState, useEffect } from 'react';
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/context/AuthContext';
import { Clock, BookOpen, CheckCircle2, XCircle, ChevronRight, Send, AlertCircle } from 'lucide-react';
import clsx from 'clsx';

interface SessionSummary {
  id: number;
  startTime: string;
  endTime: string;
  course: { titleSv: string; type: string; behorighet: string };
  bookings: { id: number; result: string | null }[];
}

export default function InstruktorPage() {
  const locale = useLocale();
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();

  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [approvingAll, setApprovingAll] = useState(false);
  const [approveAllDone, setApproveAllDone] = useState(false);
  const [approveAllError, setApproveAllError] = useState(false);

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'instructor')) {
      router.push(`/${locale}/login`);
      return;
    }
    if (user?.role === 'instructor') {
      fetch('/api/instructor/sessions/today')
        .then((r) => r.json())
        .then((d) => { setSessions(d.sessions || []); setLoading(false); })
        .catch(() => setLoading(false));
    }
  }, [user, authLoading, locale, router]);

  const handleApproveAll = async () => {
    setApprovingAll(true);
    setApproveAllError(false);
    const res = await fetch('/api/instructor/sessions/approve-all', { method: 'POST' });
    setApprovingAll(false);
    if (res.ok) setApproveAllDone(true);
    else setApproveAllError(true);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-950">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-swedish-blue border-t-transparent rounded-full animate-spin" />
        </main>
      </div>
    );
  }

  const today = new Date().toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Stockholm' });
  const totalStudents = sessions.reduce((acc, s) => acc + s.bookings.length, 0);
  const totalPassed = sessions.reduce((acc, s) => acc + s.bookings.filter(b => b.result === 'passed').length, 0);
  const totalPending = sessions.reduce((acc, s) => acc + s.bookings.filter(b => !b.result).length, 0);

  return (
    <div className="min-h-screen flex flex-col bg-gray-950">
      <Navbar />

      <main className="flex-1 pb-32">
        {/* Header */}
        <div className="bg-gray-900 border-b border-gray-800 px-4 py-5">
          <div className="max-w-2xl mx-auto">
            <p className="text-swedish-blue text-xs font-semibold uppercase tracking-wider mb-1 capitalize">{today}</p>
            <h1 className="text-2xl font-bold text-white">Instruktörsportal</h1>
            {user?.name && <p className="text-gray-400 text-sm mt-0.5">{user.name}</p>}

            {sessions.length > 0 && (
              <div className="flex gap-4 mt-4">
                <div className="flex-1 bg-gray-800 rounded-xl px-4 py-3 text-center">
                  <p className="text-2xl font-bold text-white">{sessions.length}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Sessioner</p>
                </div>
                <div className="flex-1 bg-gray-800 rounded-xl px-4 py-3 text-center">
                  <p className="text-2xl font-bold text-white">{totalStudents}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Elever</p>
                </div>
                <div className="flex-1 bg-gray-800 rounded-xl px-4 py-3 text-center">
                  <p className={clsx('text-2xl font-bold', totalPending > 0 ? 'text-yellow-400' : 'text-green-400')}>{totalPending}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Ej bedömda</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 pt-5">
          {sessions.length === 0 ? (
            <div className="bg-gray-900 rounded-2xl border border-gray-800 p-12 text-center mt-4">
              <BookOpen className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 font-medium">Inga kurser tilldelade dig idag</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sessions.map((session) => {
                const start = new Date(session.startTime);
                const end = new Date(session.endTime);
                const timeStr = `${start.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Stockholm' })}–${end.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Stockholm' })}`;
                const total = session.bookings.length;
                const passed = session.bookings.filter((b) => b.result === 'passed').length;
                const failed = session.bookings.filter((b) => b.result === 'failed').length;
                const pending = total - passed - failed;
                const isR1 = session.course.type === 'Risk1';

                return (
                  <Link
                    key={session.id}
                    href={`/${locale}/instruktor/session/${session.id}`}
                    className="block bg-gray-900 border border-gray-800 rounded-2xl p-4 active:scale-[0.98] transition-transform"
                  >
                    <div className="flex items-center gap-4">
                      <div className={clsx(
                        'w-14 h-14 rounded-xl flex items-center justify-center shrink-0 font-bold text-base',
                        isR1 ? 'bg-swedish-blue/20 text-swedish-blue' : 'bg-orange-500/20 text-orange-400'
                      )}>
                        {isR1 ? 'R1' : 'R2'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-white text-base leading-tight">{session.course.titleSv}</p>
                        <div className="flex items-center gap-1.5 text-sm text-gray-400 mt-1">
                          <Clock className="w-3.5 h-3.5 shrink-0" />
                          <span>{timeStr}</span>
                          <span className="text-gray-600">·</span>
                          <span>{session.course.behorighet}</span>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-2">
                          <span className="text-xs text-gray-500">{total} elever</span>
                          {passed > 0 && (
                            <span className="text-xs text-green-400 font-semibold flex items-center gap-0.5">
                              <CheckCircle2 className="w-3 h-3" /> {passed}
                            </span>
                          )}
                          {failed > 0 && (
                            <span className="text-xs text-red-400 font-semibold flex items-center gap-0.5">
                              <XCircle className="w-3 h-3" /> {failed}
                            </span>
                          )}
                          {pending > 0 && (
                            <span className="text-xs text-yellow-400 font-semibold">{pending} ej bedömd</span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-600 shrink-0" />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Sticky bottom approve-all */}
      {sessions.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-gray-950/95 backdrop-blur border-t border-gray-800 px-4 py-4 safe-area-inset-bottom">
          <div className="max-w-2xl mx-auto space-y-2">
            {approveAllError && (
              <div className="flex items-center gap-2 text-sm text-red-400 bg-red-950/50 border border-red-900 rounded-xl px-4 py-2.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                Kunde inte skicka. Försök igen.
              </div>
            )}
            <button
              onClick={handleApproveAll}
              disabled={approvingAll || approveAllDone}
              className={clsx(
                'w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl font-bold text-base transition',
                approveAllDone
                  ? 'bg-green-900/60 text-green-400 border border-green-800'
                  : 'bg-swedish-blue text-white active:scale-[0.98] disabled:opacity-60'
              )}
            >
              {approveAllDone ? (
                <><CheckCircle2 className="w-5 h-5" /> Alla sessioner skickade!</>
              ) : approvingAll ? (
                <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Skickar...</>
              ) : (
                <><Send className="w-5 h-5" /> Godkänn alla sessioner</>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
