'use client';

import { useState, useEffect } from 'react';
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/context/AuthContext';
import { ArrowLeft, CheckCircle2, XCircle, Send, UserPlus, Clock, X, Phone, Download } from 'lucide-react';
import clsx from 'clsx';

interface Student {
  id: number;
  guestName: string | null;
  personnummer: string | null;
  guestPhone: string | null;
  guestEmail: string | null;
  result: string | null;
  resultNote: string | null;
  bookedByRole: string;
  user: { name: string; phone: string | null; email: string } | null;
}

interface SessionDetail {
  id: number;
  startTime: string;
  endTime: string;
  course: { titleSv: string; type: string; behorighet: string; location: string };
  bookings: Student[];
}

export default function InstruktorSessionPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const locale = useLocale();
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();

  const [session, setSession] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | null>(null);
  const [approving, setApproving] = useState(false);
  const [approved, setApproved] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', personnummer: '', phone: '', email: '' });
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');
  const [expandedNote, setExpandedNote] = useState<number | null>(null);

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'instructor')) {
      router.push(`/${locale}/login`);
      return;
    }
    if (user?.role === 'instructor') {
      fetch(`/api/instructor/sessions/${id}`)
        .then((r) => r.json())
        .then((d) => { setSession(d.session || null); setLoading(false); })
        .catch(() => setLoading(false));
    }
  }, [user, authLoading, id, locale, router]);

  const setResult = async (bookingId: number, result: string | null, note?: string) => {
    setSaving(bookingId);
    const res = await fetch(`/api/instructor/bookings/${bookingId}/result`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ result, resultNote: note ?? null }),
    });
    if (res.ok) {
      setSession((prev) => prev ? {
        ...prev,
        bookings: prev.bookings.map((b) => b.id === bookingId ? { ...b, result, resultNote: note ?? b.resultNote } : b),
      } : prev);
    }
    setSaving(null);
  };

  const handleApprove = async () => {
    setApproving(true);
    await fetch(`/api/instructor/sessions/${id}/approve`, { method: 'POST' });
    setApproving(false);
    setApproved(true);
  };

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError('');
    setAdding(true);
    const res = await fetch(`/api/instructor/sessions/${id}/students`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(addForm),
    });
    const data = await res.json();
    if (!res.ok) { setAddError(data.error || 'Fel'); setAdding(false); return; }
    const newStudent: Student = {
      id: data.booking.id,
      guestName: addForm.name,
      personnummer: addForm.personnummer || null,
      guestPhone: addForm.phone || null,
      guestEmail: addForm.email || null,
      result: null,
      resultNote: null,
      bookedByRole: 'instructor',
      user: null,
    };
    setSession((prev) => prev ? { ...prev, bookings: [...prev.bookings, newStudent] } : prev);
    setAddForm({ name: '', personnummer: '', phone: '', email: '' });
    setShowAddForm(false);
    setAdding(false);
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

  if (!session) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-950">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <p className="text-gray-400">Session hittades inte.</p>
        </main>
      </div>
    );
  }

  const start = new Date(session.startTime);
  const end = new Date(session.endTime);
  const timeStr = `${start.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Stockholm' })}–${end.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Stockholm' })}`;
  const dateStr = start.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Stockholm' });
  const passed = session.bookings.filter((b) => b.result === 'passed').length;
  const failed = session.bookings.filter((b) => b.result === 'failed').length;
  const pending = session.bookings.length - passed - failed;

  return (
    <div className="min-h-screen flex flex-col bg-gray-950">
      <Navbar />

      <main className="flex-1 pb-32">
        {/* Header */}
        <div className="bg-gray-900 border-b border-gray-800 px-4 pt-4 pb-5">
          <div className="max-w-2xl mx-auto">
            <Link href={`/${locale}/instruktor`} className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-swedish-blue mb-4">
              <ArrowLeft className="w-4 h-4" /> Tillbaka
            </Link>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={clsx(
                  'text-xs font-bold px-2 py-0.5 rounded',
                  session.course.type === 'Risk1' ? 'bg-swedish-blue/20 text-swedish-blue' : 'bg-orange-500/20 text-orange-400'
                )}>
                  {session.course.type === 'Risk1' ? 'RISK 1' : 'RISK 2'}
                </span>
                <span className="text-xs text-gray-500">{session.course.behorighet}</span>
              </div>
              <h1 className="text-xl font-bold text-white leading-tight">{session.course.titleSv}</h1>
              <div className="flex items-center gap-1.5 text-sm text-gray-400 mt-1.5 capitalize">
                <Clock className="w-3.5 h-3.5 shrink-0" />
                <span>{dateStr} · {timeStr}</span>
              </div>
            </div>

            {/* Stats row */}
            <div className="flex gap-3 mt-4">
              <div className="flex-1 bg-gray-800 rounded-xl px-3 py-2.5 text-center">
                <p className="text-xl font-bold text-white">{session.bookings.length}</p>
                <p className="text-xs text-gray-500 mt-0.5">Totalt</p>
              </div>
              <div className="flex-1 bg-green-950/60 border border-green-900/40 rounded-xl px-3 py-2.5 text-center">
                <p className="text-xl font-bold text-green-400">{passed}</p>
                <p className="text-xs text-green-700 mt-0.5">Godkänd</p>
              </div>
              <div className="flex-1 bg-red-950/60 border border-red-900/40 rounded-xl px-3 py-2.5 text-center">
                <p className="text-xl font-bold text-red-400">{failed}</p>
                <p className="text-xs text-red-700 mt-0.5">Underkänd</p>
              </div>
              <div className="flex-1 bg-yellow-950/60 border border-yellow-900/40 rounded-xl px-3 py-2.5 text-center">
                <p className={clsx('text-xl font-bold', pending > 0 ? 'text-yellow-400' : 'text-gray-600')}>{pending}</p>
                <p className="text-xs text-yellow-700 mt-0.5">Ej bedömd</p>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 pt-4">
          {/* Student list */}
          <div className="space-y-2 mb-4">
            {session.bookings.map((student, idx) => {
              const name = student.guestName || student.user?.name || '–';
              const pnr = student.personnummer || null;
              const phone = student.guestPhone || student.user?.phone || null;
              const isSaving = saving === student.id;
              const showNote = expandedNote === student.id;

              return (
                <div key={student.id} className={clsx(
                  'bg-gray-900 rounded-2xl border overflow-hidden',
                  student.result === 'passed' ? 'border-green-900/60' :
                  student.result === 'failed' ? 'border-red-900/60' :
                  'border-gray-800'
                )}>
                  {/* Student info row */}
                  <div className="px-4 pt-4 pb-3">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="text-xs text-gray-600 font-mono shrink-0">#{idx + 1}</span>
                        <p className="font-semibold text-white text-base truncate">{name}</p>
                        {student.bookedByRole === 'instructor' && (
                          <span className="text-xs bg-purple-900/50 text-purple-400 border border-purple-800/40 px-1.5 py-0.5 rounded font-medium shrink-0">Walk-in</span>
                        )}
                      </div>
                      {isSaving && <div className="w-4 h-4 border-2 border-swedish-blue border-t-transparent rounded-full animate-spin shrink-0" />}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                      {pnr && <span className="text-gray-400"><span className="text-gray-600 text-xs">PNR </span>{pnr}</span>}
                      {phone && (
                        <a href={`tel:${phone}`} className="text-swedish-blue flex items-center gap-1 font-medium">
                          <Phone className="w-3.5 h-3.5" /> {phone}
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Pass/Fail buttons — full width, large */}
                  <div className="grid grid-cols-2 border-t border-gray-800">
                    <button
                      onClick={() => setResult(student.id, student.result === 'passed' ? null : 'passed')}
                      disabled={isSaving}
                      className={clsx(
                        'flex items-center justify-center gap-2 py-3.5 font-bold text-sm border-r border-gray-800 transition active:scale-95',
                        student.result === 'passed'
                          ? 'bg-green-600 text-white'
                          : 'text-green-400 hover:bg-green-950/40 active:bg-green-950/60'
                      )}
                    >
                      <CheckCircle2 className="w-4 h-4" /> Godkänd
                    </button>
                    <button
                      onClick={() => setResult(student.id, student.result === 'failed' ? null : 'failed')}
                      disabled={isSaving}
                      className={clsx(
                        'flex items-center justify-center gap-2 py-3.5 font-bold text-sm transition active:scale-95',
                        student.result === 'failed'
                          ? 'bg-red-600 text-white'
                          : 'text-red-400 hover:bg-red-950/40 active:bg-red-950/60'
                      )}
                    >
                      <XCircle className="w-4 h-4" /> Underkänd
                    </button>
                  </div>

                  {/* Note toggle */}
                  <div className="border-t border-gray-800">
                    {showNote ? (
                      <div className="flex items-center gap-2 px-3 py-2">
                        <input
                          type="text"
                          placeholder="Notering..."
                          defaultValue={student.resultNote || ''}
                          autoFocus
                          onBlur={(e) => {
                            if (e.target.value !== (student.resultNote || '')) {
                              setResult(student.id, student.result, e.target.value);
                            }
                            setExpandedNote(null);
                          }}
                          className="flex-1 bg-transparent text-sm text-gray-300 placeholder-gray-600 focus:outline-none"
                        />
                        <button onClick={() => setExpandedNote(null)} className="text-gray-600">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setExpandedNote(student.id)}
                        className="w-full text-left px-4 py-2.5 text-xs text-gray-600 hover:text-gray-400 transition"
                      >
                        {student.resultNote ? (
                          <span className="text-gray-400">Notering: {student.resultNote}</span>
                        ) : (
                          '+ Lägg till notering'
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {session.bookings.length === 0 && (
              <div className="bg-gray-900 rounded-2xl border border-gray-800 p-10 text-center">
                <p className="text-gray-500 text-sm">Inga elever bokade på denna session.</p>
              </div>
            )}
          </div>

          {/* Add walk-in student */}
          {showAddForm ? (
            <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5 mb-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-white">Lägg till elev</h3>
                <button onClick={() => setShowAddForm(false)}><X className="w-4 h-4 text-gray-500" /></button>
              </div>
              <form onSubmit={handleAddStudent} className="space-y-3">
                <input
                  required placeholder="Namn *" value={addForm.name}
                  onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-swedish-blue/40"
                />
                <input
                  placeholder="Personnummer" value={addForm.personnummer}
                  onChange={(e) => setAddForm((f) => ({ ...f, personnummer: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-swedish-blue/40"
                />
                <input
                  placeholder="Telefon" value={addForm.phone}
                  onChange={(e) => setAddForm((f) => ({ ...f, phone: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-swedish-blue/40"
                />
                <input
                  type="email" placeholder="E-post" value={addForm.email}
                  onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-swedish-blue/40"
                />
                {addError && <p className="text-xs text-red-400">{addError}</p>}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button type="button" onClick={() => setShowAddForm(false)}
                    className="border border-gray-700 text-gray-400 font-medium py-3 rounded-xl text-sm hover:bg-gray-800 transition">
                    Avbryt
                  </button>
                  <button type="submit" disabled={adding}
                    className="bg-swedish-blue text-white font-semibold py-3 rounded-xl text-sm disabled:opacity-60 transition">
                    {adding ? 'Lägger till...' : 'Lägg till'}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <button onClick={() => setShowAddForm(true)}
              className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-800 text-gray-500 hover:border-swedish-blue/30 hover:text-swedish-blue rounded-2xl py-4 text-sm font-medium transition mb-4">
              <UserPlus className="w-4 h-4" /> Lägg till saknad elev
            </button>
          )}
        </div>
      </main>

      {/* Sticky bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-950/95 backdrop-blur border-t border-gray-800 px-4 py-4">
        <div className="max-w-2xl mx-auto flex gap-3">
          <a
            href={`/api/instructor/sessions/${id}/approve`}
            download
            className="flex items-center gap-1.5 px-4 py-4 text-sm bg-gray-800 text-gray-300 rounded-2xl hover:bg-gray-700 transition font-semibold shrink-0"
          >
            <Download className="w-4 h-4" /> XML
          </a>
          <button
            onClick={handleApprove}
            disabled={approving || approved}
            className={clsx(
              'flex-1 flex items-center justify-center gap-2.5 py-4 rounded-2xl font-bold text-base transition',
              approved
                ? 'bg-green-900/60 text-green-400 border border-green-800'
                : 'bg-swedish-blue text-white active:scale-[0.98] disabled:opacity-60'
            )}
          >
            {approved ? (
              <><CheckCircle2 className="w-5 h-5" /> Resultat skickat!</>
            ) : approving ? (
              <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Skickar...</>
            ) : (
              <><Send className="w-5 h-5" /> Godkänn & skicka resultat</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
