'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import type { Session } from '@/lib/types';
import { Calendar, Users, X, Plus, Building2, Trash2, CheckCircle2 } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '@/context/AuthContext';

interface StudentForm {
  name: string;
  personnummer: string;
  phone: string;
  email: string;
}

interface SchoolBooking {
  id: number;
  guestName: string | null;
  personnummer: string | null;
  guestPhone: string | null;
  guestEmail: string | null;
  status: string;
  bookingTime: string;
  session: Session & { course: { titleSv: string; titleEn: string } };
}

export default function SchoolPage() {
  const locale = useLocale();
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();

  const [sessions, setSessions] = useState<Session[]>([]);
  const [bookings, setBookings] = useState<SchoolBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'sessions' | 'students'>('sessions');

  // Add student modal
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [students, setStudents] = useState<StudentForm[]>([{ name: '', personnummer: '', phone: '', email: '' }]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [sessionsRes, bookingsRes] = await Promise.all([
      fetch('/api/sessions?includeSchool=true'),
      fetch('/api/school/bookings'),
    ]);
    const [sessionsData, bookingsData] = await Promise.all([
      sessionsRes.json(),
      bookingsRes.json(),
    ]);
    setSessions(sessionsData.sessions || []);
    setBookings(bookingsData.bookings || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!authLoading && !user) { router.push(`/${locale}/login`); return; }
    if (!authLoading && user && user.role !== 'school' && user.role !== 'admin') {
      router.push(`/${locale}`); return;
    }
    if (!authLoading && user) loadData();
  }, [user, authLoading, locale, router, loadData]);

  const openModal = (session: Session) => {
    setActiveSession(session);
    setStudents([{ name: '', personnummer: '', phone: '', email: '' }]);
    setSaveError('');
    setSaveSuccess(false);
  };

  const addStudentRow = () => setStudents((p) => [...p, { name: '', personnummer: '', phone: '', email: '' }]);
  const removeStudentRow = (i: number) => setStudents((p) => p.filter((_, idx) => idx !== i));
  const updateStudentRow = (i: number, field: keyof StudentForm, value: string) =>
    setStudents((p) => p.map((s, idx) => idx === i ? { ...s, [field]: value } : s));

  const handleSaveStudents = async () => {
    if (!activeSession) return;
    const valid = students.every((s) => s.name.trim() && s.personnummer.trim());
    if (!valid) { setSaveError('Namn och personnummer krävs för alla elever.'); return; }

    setSaving(true);
    setSaveError('');

    for (const student of students) {
      const res = await fetch('/api/school/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: activeSession.id,
          guestName: student.name,
          personnummer: student.personnummer,
          guestPhone: student.phone || null,
          guestEmail: student.email || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setSaveError(`Fel för ${student.name}: ${data.error}`);
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    setSaveSuccess(true);
    await loadData();
    setTimeout(() => {
      setActiveSession(null);
      setSaveSuccess(false);
    }, 1500);
  };

  const handleDeleteStudent = async (bookingId: number) => {
    await fetch(`/api/school/bookings/${bookingId}`, { method: 'DELETE' });
    setBookings((prev) => prev.filter((b) => b.id !== bookingId));
    // Also reload to refresh seat counts
    loadData();
  };

  // Group bookings by session
  const bookingsBySession = bookings.reduce<Record<number, { session: SchoolBooking['session']; students: SchoolBooking[] }>>((acc, b) => {
    const sid = b.session.id;
    if (!acc[sid]) acc[sid] = { session: b.session, students: [] };
    acc[sid].students.push(b);
    return acc;
  }, {});

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

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />

      <main className="flex-1 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-swedish-blue flex items-center justify-center">
              <Building2 className="w-5 h-5 text-swedish-yellow" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{user?.name}</h1>
              <p className="text-sm text-gray-500">Trafikskolakonto</p>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-6 text-sm text-amber-800">
            Bokningar faktureras den 26:e varje månad. Ingen betalning krävs vid bokning.
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1 mb-6 w-fit">
            {[
              { id: 'sessions' as const, label: 'Tillgängliga pass', icon: <Calendar className="w-4 h-4" /> },
              { id: 'students' as const, label: `Mina elever (${bookings.length})`, icon: <Users className="w-4 h-4" /> },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={clsx(
                  'flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition',
                  tab === t.id ? 'bg-swedish-blue text-white' : 'text-gray-600 hover:bg-gray-50'
                )}
              >
                {t.icon}{t.label}
              </button>
            ))}
          </div>

          {/* Sessions tab */}
          {tab === 'sessions' && (
            <div className="space-y-3">
              {sessions.length === 0 ? (
                <div className="text-center py-16 text-gray-500 bg-white rounded-xl border border-gray-100">
                  <Calendar className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                  <p className="font-medium">Inga tillgängliga pass</p>
                  <p className="text-sm mt-1">Kontakta administratören för att tilldela pass till er skola.</p>
                </div>
              ) : sessions.map((s) => {
                const title = locale === 'sv' ? s.course?.titleSv : s.course?.titleEn;
                const start = new Date(s.startTime);
                const end = new Date(s.endTime);
                const full = s.seatsAvailable === 0;
                return (
                  <div key={s.id} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className={clsx(
                        'w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm shrink-0',
                        s.course?.type === 'Risk1' ? 'bg-blue-100 text-swedish-blue' : 'bg-orange-100 text-orange-700'
                      )}>
                        {s.course?.type === 'Risk1' ? 'R1' : 'R2'}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900">{title}</p>
                        <div className="flex flex-wrap gap-3 text-xs text-gray-500 mt-1">
                          <span>📅 {start.toLocaleDateString('sv-SE')}</span>
                          <span>🕐 {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – {end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          <span>📍 {s.school?.name}</span>
                          <span className={clsx(full ? 'text-red-500 font-semibold' : 'text-green-600')}>
                            👤 {s.seatsAvailable}/{s.seatLimit} platser kvar
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      disabled={full}
                      onClick={() => openModal(s)}
                      className={clsx(
                        'shrink-0 px-4 py-2 text-sm font-semibold rounded-xl transition flex items-center gap-2',
                        full
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-swedish-blue text-white hover:bg-blue-700'
                      )}
                    >
                      <Plus className="w-4 h-4" />
                      {full ? 'Fullbokat' : 'Lägg till elever'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Students tab */}
          {tab === 'students' && (
            <div className="space-y-4">
              {Object.keys(bookingsBySession).length === 0 ? (
                <div className="text-center py-16 text-gray-500 bg-white rounded-xl border border-gray-100">
                  <Users className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                  <p className="font-medium">Inga elever bokade ännu</p>
                  <p className="text-sm mt-1">Gå till Tillgängliga pass och lägg till elever.</p>
                </div>
              ) : Object.values(bookingsBySession).map(({ session: s, students: booked }) => (
                <div key={s.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                  <div className="bg-gray-50 px-5 py-3 flex items-center justify-between border-b border-gray-100">
                    <div>
                      <p className="font-semibold text-gray-900">
                        {locale === 'sv' ? s.course?.titleSv : s.course?.titleEn}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        📅 {new Date(s.startTime).toLocaleDateString('sv-SE')} · 🕐 {new Date(s.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · 📍 {s.school?.name}
                      </p>
                    </div>
                    <span className="text-xs bg-blue-100 text-blue-700 font-semibold px-2.5 py-1 rounded-full">
                      {booked.length} elev{booked.length !== 1 ? 'er' : ''}
                    </span>
                  </div>
                  <table className="w-full text-sm">
                    <thead className="text-xs text-gray-400 uppercase tracking-wide border-b border-gray-50">
                      <tr>
                        <th className="text-left py-2.5 px-5">Namn</th>
                        <th className="text-left py-2.5 px-5">Personnummer</th>
                        <th className="text-left py-2.5 px-5">Telefon</th>
                        <th className="text-left py-2.5 px-5">E-post</th>
                        <th className="py-2.5 px-5"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {booked.map((b) => (
                        <tr key={b.id} className="hover:bg-gray-50">
                          <td className="py-3 px-5 font-medium">{b.guestName || '–'}</td>
                          <td className="py-3 px-5 font-mono text-xs text-gray-600">{b.personnummer || '–'}</td>
                          <td className="py-3 px-5 text-gray-500 text-xs">{b.guestPhone || '–'}</td>
                          <td className="py-3 px-5 text-gray-500 text-xs">{b.guestEmail || '–'}</td>
                          <td className="py-3 px-5 text-right">
                            <button
                              onClick={() => handleDeleteStudent(b.id)}
                              className="text-gray-300 hover:text-red-500 transition"
                              title="Ta bort elev"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Add students modal */}
      {activeSession && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-xl w-full shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-lg">Lägg till elever</h3>
                <p className="text-sm text-gray-500">
                  {locale === 'sv' ? activeSession.course?.titleSv : activeSession.course?.titleEn} · {new Date(activeSession.startTime).toLocaleDateString('sv-SE')} · {activeSession.seatsAvailable} platser kvar
                </p>
              </div>
              <button onClick={() => setActiveSession(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {saveSuccess ? (
              <div className="flex-1 flex flex-col items-center justify-center py-10 text-center">
                <CheckCircle2 className="w-12 h-12 text-green-500 mb-3" />
                <p className="font-semibold text-gray-900">Eleverna är tillagda!</p>
              </div>
            ) : (
              <>
                <div className="overflow-auto flex-1 space-y-3 pr-1">
                  {saveError && (
                    <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
                      {saveError}
                    </div>
                  )}
                  {students.map((s, i) => (
                    <div key={i} className="border border-gray-200 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-gray-700">Elev {i + 1}</span>
                        {students.length > 1 && (
                          <button onClick={() => removeStudentRow(i)} className="text-red-400 hover:text-red-600">
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Namn *</label>
                          <input type="text" className="input-field text-sm" placeholder="Anna Svensson" value={s.name} onChange={(e) => updateStudentRow(i, 'name', e.target.value)} />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Personnummer *</label>
                          <input type="text" className="input-field text-sm font-mono" placeholder="YYYYMMDD-XXXX" value={s.personnummer} onChange={(e) => updateStudentRow(i, 'personnummer', e.target.value)} />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Telefon</label>
                          <input type="tel" className="input-field text-sm" placeholder="070-123 45 67" value={s.phone} onChange={(e) => updateStudentRow(i, 'phone', e.target.value)} />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">E-post</label>
                          <input type="email" className="input-field text-sm" placeholder="anna@skola.se" value={s.email} onChange={(e) => updateStudentRow(i, 'email', e.target.value)} />
                        </div>
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={addStudentRow}
                    disabled={students.length >= activeSession.seatsAvailable}
                    className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-swedish-blue hover:text-swedish-blue transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Plus className="w-4 h-4" />Lägg till fler elever
                  </button>
                </div>

                <div className="flex gap-3 pt-4 mt-2 border-t border-gray-100">
                  <button onClick={() => setActiveSession(null)} className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl hover:bg-gray-50 text-sm font-medium">
                    Avbryt
                  </button>
                  <button
                    onClick={handleSaveStudents}
                    disabled={saving}
                    className="flex-1 btn-primary py-2.5 text-sm font-semibold disabled:opacity-60"
                  >
                    {saving ? 'Sparar...' : `Spara ${students.length} elev${students.length !== 1 ? 'er' : ''}`}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
