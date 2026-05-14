'use client';

import { useState, useEffect } from 'react';
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useAuth } from '@/context/AuthContext';
import { Clock, BookOpen, CheckCircle2, XCircle, ChevronRight, Send } from 'lucide-react';
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
    await fetch('/api/instructor/sessions/approve-all', { method: 'POST' });
    setApprovingAll(false);
    setApproveAllDone(true);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-swedish-blue border-t-transparent rounded-full animate-spin" />
        </main>
        <Footer />
      </div>
    );
  }

  const today = new Date().toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Stockholm' });

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />
      <main className="flex-1 py-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="mb-8 flex items-start justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Instruktörsportal</h1>
              <p className="text-gray-500 text-sm mt-1 capitalize">{today}</p>
            </div>
            {sessions.length > 0 && (
              <button
                onClick={handleApproveAll}
                disabled={approvingAll || approveAllDone}
                className={clsx(
                  'flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition',
                  approveAllDone
                    ? 'bg-green-100 text-green-700'
                    : 'bg-swedish-blue text-white hover:bg-swedish-dark disabled:opacity-60'
                )}
              >
                {approveAllDone ? (
                  <><CheckCircle2 className="w-4 h-4" /> Alla skickade</>
                ) : approvingAll ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Skickar...</>
                ) : (
                  <><Send className="w-4 h-4" /> Godkänn alla sessioner</>
                )}
              </button>
            )}
          </div>

          {sessions.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
              <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 font-medium">Inga kurser tilldelade dig idag</p>
            </div>
          ) : (
            <div className="space-y-4">
              {sessions.map((session) => {
                const start = new Date(session.startTime);
                const end = new Date(session.endTime);
                const timeStr = `${start.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Stockholm' })} – ${end.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Stockholm' })}`;
                const total = session.bookings.length;
                const passed = session.bookings.filter((b) => b.result === 'passed').length;
                const failed = session.bookings.filter((b) => b.result === 'failed').length;
                const pending = total - passed - failed;

                return (
                  <Link
                    key={session.id}
                    href={`/${locale}/instruktor/session/${session.id}`}
                    className="block bg-white rounded-2xl border border-gray-100 p-5 hover:border-swedish-blue/30 hover:shadow-sm transition group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-start gap-4">
                        <div className={clsx(
                          'w-11 h-11 rounded-xl flex items-center justify-center shrink-0 font-bold text-sm',
                          session.course.type === 'Risk1' ? 'bg-brand-100 text-swedish-blue' : 'bg-orange-100 text-orange-700'
                        )}>
                          {session.course.type === 'Risk1' ? 'R1' : 'R2'}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{session.course.titleSv} <span className="text-gray-400 font-normal text-sm">({session.course.behorighet})</span></p>
                          <div className="flex items-center gap-1.5 text-sm text-gray-500 mt-0.5">
                            <Clock className="w-3.5 h-3.5" /> {timeStr}
                          </div>
                          <div className="flex gap-3 mt-2">
                            <span className="text-xs text-gray-500">{total} elever</span>
                            {passed > 0 && <span className="text-xs text-green-600 font-semibold flex items-center gap-0.5"><CheckCircle2 className="w-3 h-3" /> {passed} godkänd</span>}
                            {failed > 0 && <span className="text-xs text-red-600 font-semibold flex items-center gap-0.5"><XCircle className="w-3 h-3" /> {failed} underkänd</span>}
                            {pending > 0 && <span className="text-xs text-yellow-600 font-semibold">{pending} ej bedömd</span>}
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-swedish-blue transition" />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
