'use client';

import { useState, useEffect, use } from 'react';
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useAuth } from '@/context/AuthContext';
import { ArrowLeft, CheckCircle2, XCircle, Plus, Send, UserPlus, Clock, X } from 'lucide-react';
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

export default function InstruktorSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
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
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-swedish-blue border-t-transparent rounded-full animate-spin" />
        </main>
        <Footer />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <p className="text-gray-500">Session hittades inte.</p>
        </main>
        <Footer />
      </div>
    );
  }

  const start = new Date(session.startTime);
  const end = new Date(session.endTime);
  const timeStr = `${start.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Stockholm' })} – ${end.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Stockholm' })}`;
  const dateStr = start.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Stockholm' });

  const passed = session.bookings.filter((b) => b.result === 'passed').length;
  const failed = session.bookings.filter((b) => b.result === 'failed').length;
  const pending = session.bookings.length - passed - failed;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />
      <main className="flex-1 py-8">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">

          {/* Back + header */}
          <div className="mb-6">
            <Link href={`/${locale}/instruktor`} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-swedish-blue mb-4">
              <ArrowLeft className="w-4 h-4" /> Tillbaka
            </Link>
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div>
                <h1 className="text-xl font-bold text-gray-900">{session.course.titleSv} <span className="text-gray-400 font-normal">({session.course.behorighet})</span></h1>
                <div className="flex items-center gap-1.5 text-sm text-gray-500 mt-1 capitalize">
                  <Clock className="w-3.5 h-3.5" /> {dateStr} · {timeStr}
                </div>
              </div>
              <div className="flex gap-2">
                <span className="text-xs bg-green-100 text-green-700 font-semibold px-2.5 py-1 rounded-full">{passed} godkänd</span>
                <span className="text-xs bg-red-100 text-red-700 font-semibold px-2.5 py-1 rounded-full">{failed} underkänd</span>
                {pending > 0 && <span className="text-xs bg-yellow-100 text-yellow-700 font-semibold px-2.5 py-1 rounded-full">{pending} ej bedömd</span>}
              </div>
            </div>
          </div>

          {/* Student list */}
          <div className="space-y-3 mb-6">
            {session.bookings.map((student, idx) => {
              const name = student.guestName || student.user?.name || '–';
              const pnr = student.personnummer || '–';
              const phone = student.guestPhone || student.user?.phone || '–';
              const isSaving = saving === student.id;

              return (
                <div key={student.id} className="bg-white rounded-xl border border-gray-100 p-4">
                  <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-gray-400 font-mono">#{idx + 1}</span>
                        <p className="font-semibold text-gray-900 text-sm">{name}</p>
                        {student.bookedByRole === 'instructor' && (
                          <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-medium">Walk-in</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                        <span>PNR: <span className="text-gray-700 font-medium">{pnr}</span></span>
                        <span>Tel: <span className="text-gray-700 font-medium">{phone}</span></span>
                      </div>
                    </div>

                    {/* Pass/Fail buttons */}
                    <div className="flex items-center gap-2 shrink-0">
                      {isSaving ? (
                        <div className="w-5 h-5 border-2 border-swedish-blue border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <button
                            onClick={() => setResult(student.id, student.result === 'passed' ? null : 'passed')}
                            className={clsx(
                              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold border transition',
                              student.result === 'passed'
                                ? 'bg-green-500 text-white border-green-500'
                                : 'bg-white text-green-600 border-green-200 hover:bg-green-50'
                            )}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" /> Godkänd
                          </button>
                          <button
                            onClick={() => setResult(student.id, student.result === 'failed' ? null : 'failed')}
                            className={clsx(
                              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold border transition',
                              student.result === 'failed'
                                ? 'bg-red-500 text-white border-red-500'
                                : 'bg-white text-red-600 border-red-200 hover:bg-red-50'
                            )}
                          >
                            <XCircle className="w-3.5 h-3.5" /> Underkänd
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Note input */}
                  <div className="mt-3">
                    <input
                      type="text"
                      placeholder="Notering (valfritt)"
                      defaultValue={student.resultNote || ''}
                      onBlur={(e) => {
                        if (e.target.value !== (student.resultNote || '')) {
                          setResult(student.id, student.result, e.target.value);
                        }
                      }}
                      className="w-full text-xs border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-swedish-blue/30"
                    />
                  </div>
                </div>
              );
            })}

            {session.bookings.length === 0 && (
              <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
                <p className="text-gray-400 text-sm">Inga elever bokade på denna session.</p>
              </div>
            )}
          </div>

          {/* Add student */}
          {showAddForm ? (
            <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">Lägg till elev</h3>
                <button onClick={() => setShowAddForm(false)}><X className="w-4 h-4 text-gray-400" /></button>
              </div>
              <form onSubmit={handleAddStudent} className="space-y-3">
                <input required placeholder="Namn *" value={addForm.name} onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                  className="input-field text-sm" />
                <input placeholder="Personnummer" value={addForm.personnummer} onChange={(e) => setAddForm((f) => ({ ...f, personnummer: e.target.value }))}
                  className="input-field text-sm" />
                <input placeholder="Telefon" value={addForm.phone} onChange={(e) => setAddForm((f) => ({ ...f, phone: e.target.value }))}
                  className="input-field text-sm" />
                <input type="email" placeholder="E-post" value={addForm.email} onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
                  className="input-field text-sm" />
                {addError && <p className="text-xs text-red-600">{addError}</p>}
                <div className="flex gap-2 pt-1">
                  <button type="button" onClick={() => setShowAddForm(false)} className="flex-1 border border-gray-200 text-gray-600 font-medium py-2 rounded-xl text-sm hover:bg-gray-50 transition">Avbryt</button>
                  <button type="submit" disabled={adding} className="flex-1 bg-swedish-blue text-white font-medium py-2 rounded-xl text-sm hover:bg-swedish-dark transition disabled:opacity-60">
                    {adding ? 'Lägger till...' : 'Lägg till'}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <button onClick={() => setShowAddForm(true)}
              className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-200 text-gray-500 hover:border-swedish-blue/40 hover:text-swedish-blue rounded-xl py-3 text-sm font-medium transition mb-6">
              <UserPlus className="w-4 h-4" /> Lägg till saknad elev
            </button>
          )}

          {/* Approve session */}
          <button
            onClick={handleApprove}
            disabled={approving || approved}
            className={clsx(
              'w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-base transition',
              approved
                ? 'bg-green-100 text-green-700'
                : 'bg-swedish-blue text-white hover:bg-swedish-dark disabled:opacity-60'
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
      </main>
      <Footer />
    </div>
  );
}
