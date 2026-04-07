'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import type { Session } from '@/lib/types';
import { Calendar, Users, CheckCircle2, X, Plus, Building2 } from 'lucide-react';
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
  session: Session;
  guestName: string;
  personnummer: string;
  guestPhone: string;
  guestEmail: string;
  status: string;
  bookingTime: string;
}

export default function SchoolPage() {
  const locale = useLocale();
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();

  const [sessions, setSessions] = useState<Session[]>([]);
  const [bookings, setBookings] = useState<SchoolBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'sessions' | 'bookings'>('sessions');

  // Booking modal state
  const [bookingSession, setBookingSession] = useState<Session | null>(null);
  const [students, setStudents] = useState<StudentForm[]>([{ name: '', personnummer: '', phone: '', email: '' }]);
  const [booking, setBooking] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [bookingError, setBookingError] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    const [sessionsRes, bookingsRes] = await Promise.all([
      fetch('/api/sessions?includeSchool=true'),
      fetch('/api/bookings'),
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
      router.push(`/${locale}/dashboard`);
      return;
    }
    if (!authLoading && user) loadData();
  }, [user, authLoading, locale, router, loadData]);

  const addStudent = () => setStudents((prev) => [...prev, { name: '', personnummer: '', phone: '', email: '' }]);
  const removeStudent = (i: number) => setStudents((prev) => prev.filter((_, idx) => idx !== i));
  const updateStudent = (i: number, field: keyof StudentForm, value: string) => {
    setStudents((prev) => prev.map((s, idx) => idx === i ? { ...s, [field]: value } : s));
  };

  const handleBookStudents = async () => {
    if (!bookingSession) return;
    const valid = students.every((s) => s.name.trim() && s.personnummer.trim());
    if (!valid) {
      setBookingError('Namn och personnummer krävs för alla elever.');
      return;
    }
    setBooking(true);
    setBookingError('');

    let allOk = true;
    for (const student of students) {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: bookingSession.id,
          guestName: student.name,
          personnummer: student.personnummer,
          guestPhone: student.phone,
          guestEmail: student.email,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setBookingError(`Fel för ${student.name}: ${data.error}`);
        allOk = false;
        break;
      }
    }

    setBooking(false);
    if (allOk) {
      setBookingSuccess(true);
      setTimeout(() => {
        setBookingSession(null);
        setStudents([{ name: '', personnummer: '', phone: '', email: '' }]);
        setBookingSuccess(false);
        loadData();
      }, 2000);
    }
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

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />

      <main className="flex-1 py-8">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-swedish-blue flex items-center justify-center">
              <Building2 className="w-5 h-5 text-swedish-yellow" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Skolkonto</h1>
              <p className="text-sm text-gray-500">{user?.name}</p>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-6 text-sm text-amber-800">
            Bokningar via skolkonto faktureras den 26:e varje månad. Ingen betalning krävs vid bokning.
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1 mb-6 w-fit">
            {[
              { id: 'sessions' as const, label: 'Tillgängliga pass', icon: <Calendar className="w-4 h-4" /> },
              { id: 'bookings' as const, label: 'Mina bokningar', icon: <Users className="w-4 h-4" /> },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={clsx(
                  'flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition',
                  tab === t.id ? 'bg-swedish-blue text-white' : 'text-gray-600 hover:bg-gray-50'
                )}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>

          {/* Available sessions */}
          {tab === 'sessions' && (
            <div className="space-y-3">
              {sessions.length === 0 && (
                <div className="text-center py-12 text-gray-500 bg-white rounded-xl border border-gray-100">
                  <Calendar className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                  <p>Inga tillgängliga pass just nu.</p>
                </div>
              )}
              {sessions.map((s) => {
                const title = locale === 'sv' ? s.course?.titleSv : s.course?.titleEn;
                const start = new Date(s.startTime);
                return (
                  <div key={s.id} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={clsx(
                        'w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm shrink-0',
                        s.course?.type === 'Risk1' ? 'bg-blue-100 text-swedish-blue' : 'bg-orange-100 text-orange-700'
                      )}>
                        {s.course?.type === 'Risk1' ? 'R1' : 'R2'}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{title}</p>
                        <div className="flex gap-4 text-xs text-gray-500 mt-1">
                          <span>📅 {start.toLocaleDateString('sv-SE')}</span>
                          <span>🕐 {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          <span>📍 {s.school?.name}</span>
                          <span className={clsx(s.seatsAvailable === 0 ? 'text-red-500' : '')}>
                            👤 {s.seatsAvailable}/{s.seatLimit} platser kvar
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      disabled={s.seatsAvailable === 0}
                      onClick={() => { setBookingSession(s); setStudents([{ name: '', personnummer: '', phone: '', email: '' }]); setBookingError(''); setBookingSuccess(false); }}
                      className={clsx(
                        'px-4 py-2 text-sm font-medium rounded-xl transition',
                        s.seatsAvailable === 0
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-swedish-blue text-white hover:bg-blue-700'
                      )}
                    >
                      {s.seatsAvailable === 0 ? 'Fullbokat' : 'Boka elever'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* School's bookings */}
          {tab === 'bookings' && (
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              {bookings.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Users className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                  <p>Inga bokningar ännu.</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                    <tr>
                      <th className="text-left py-3 px-5">Elev</th>
                      <th className="text-left py-3 px-5">Personnummer</th>
                      <th className="text-left py-3 px-5">Kurs</th>
                      <th className="text-left py-3 px-5">Datum</th>
                      <th className="text-left py-3 px-5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {bookings.map((b) => (
                      <tr key={b.id} className="hover:bg-gray-50">
                        <td className="py-3 px-5 font-medium">{b.guestName || '–'}</td>
                        <td className="py-3 px-5 font-mono text-xs text-gray-600">{b.personnummer || '–'}</td>
                        <td className="py-3 px-5">
                          {locale === 'sv' ? b.session?.course?.titleSv : b.session?.course?.titleEn}
                        </td>
                        <td className="py-3 px-5 text-gray-500">
                          {b.session ? new Date(b.session.startTime).toLocaleDateString('sv-SE') : '–'}
                        </td>
                        <td className="py-3 px-5">
                          <span className={clsx(
                            'px-2.5 py-1 rounded-full text-xs font-semibold',
                            b.status === 'Paid' || b.status === 'Confirmed' ? 'bg-green-100 text-green-700' :
                            b.status === 'Canceled' ? 'bg-red-100 text-red-700' :
                            'bg-yellow-100 text-yellow-700'
                          )}>
                            {b.status === 'Pending' ? 'Bokad (ej betald)' : b.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Book students modal */}
      {bookingSession && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-xl w-full shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-lg">Boka elever</h3>
                <p className="text-sm text-gray-500">
                  {locale === 'sv' ? bookingSession.course?.titleSv : bookingSession.course?.titleEn} · {new Date(bookingSession.startTime).toLocaleDateString('sv-SE')}
                </p>
              </div>
              <button onClick={() => setBookingSession(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {bookingSuccess ? (
              <div className="flex-1 flex flex-col items-center justify-center py-8 text-center">
                <CheckCircle2 className="w-12 h-12 text-green-500 mb-3" />
                <p className="font-semibold text-gray-900">Bokning lyckades!</p>
                <p className="text-sm text-gray-500 mt-1">Eleverna är bokade på passet.</p>
              </div>
            ) : (
              <div className="overflow-auto flex-1 space-y-4 pr-1">
                {bookingError && (
                  <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
                    {bookingError}
                  </div>
                )}

                {students.map((s, i) => (
                  <div key={i} className="border border-gray-200 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Elev {i + 1}</span>
                      {students.length > 1 && (
                        <button onClick={() => removeStudent(i)} className="text-red-400 hover:text-red-600">
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Namn *</label>
                        <input type="text" className="input-field text-sm" placeholder="Anna Svensson" value={s.name} onChange={(e) => updateStudent(i, 'name', e.target.value)} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Personnummer *</label>
                        <input type="text" className="input-field text-sm font-mono" placeholder="YYYYMMDD-XXXX" value={s.personnummer} onChange={(e) => updateStudent(i, 'personnummer', e.target.value)} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Telefon</label>
                        <input type="tel" className="input-field text-sm" placeholder="070-123 45 67" value={s.phone} onChange={(e) => updateStudent(i, 'phone', e.target.value)} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">E-post</label>
                        <input type="email" className="input-field text-sm" placeholder="anna@skola.se" value={s.email} onChange={(e) => updateStudent(i, 'email', e.target.value)} />
                      </div>
                    </div>
                  </div>
                ))}

                <button
                  onClick={addStudent}
                  className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-swedish-blue hover:text-swedish-blue transition"
                >
                  <Plus className="w-4 h-4" />
                  Lägg till elev
                </button>
              </div>
            )}

            {!bookingSuccess && (
              <div className="flex gap-3 pt-4 mt-2 border-t border-gray-100">
                <button onClick={() => setBookingSession(null)} className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl hover:bg-gray-50">
                  Avbryt
                </button>
                <button
                  onClick={handleBookStudents}
                  disabled={booking}
                  className="flex-1 btn-primary py-2.5 disabled:opacity-60"
                >
                  {booking ? 'Bokar...' : `Boka ${students.length} elev${students.length !== 1 ? 'er' : ''}`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
