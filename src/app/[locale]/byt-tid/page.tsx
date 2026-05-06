'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Clock, MapPin, Users, Calendar, CheckCircle2, Lock, ArrowLeft } from 'lucide-react';
import clsx from 'clsx';

const LOCK_HOURS = 74;

interface SessionInfo {
  id: number;
  startTime: string;
  endTime: string;
  seatsAvailable: number;
  seatLimit: number;
  course: { titleSv: string; titleEn: string; behorighet: string; location: string; type: string };
  school: { name: string } | null;
}

interface BookingInfo {
  id: number;
  status: string;
  guestName?: string | null;
  personnummer?: string | null;
  session: SessionInfo;
}

type PageState = 'idle' | 'loading' | 'email-form' | 'email-sent' | 'view' | 'success' | 'error';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('sv-SE', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Stockholm',
  });
}

function formatTime(start: string, end: string) {
  const fmt = (iso: string) => new Date(iso).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Stockholm' });
  return `${fmt(start)} – ${fmt(end)}`;
}

function BytTidContent() {
  const searchParams = useSearchParams();
  const { user, isLoading: authLoading } = useAuth();

  const token = searchParams.get('token');
  const bookingIdParam = searchParams.get('bookingId');

  const [state, setState] = useState<PageState>('idle');
  const [email, setEmail] = useState('');
  const [emailSending, setEmailSending] = useState(false);
  const [booking, setBooking] = useState<BookingInfo | null>(null);
  const [alternatives, setAlternatives] = useState<SessionInfo[]>([]);
  const [locked, setLocked] = useState(false);
  const [hoursUntil, setHoursUntil] = useState(0);
  const [selectedSession, setSelectedSession] = useState<SessionInfo | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');
  const [successSession, setSuccessSession] = useState<SessionInfo | null>(null);

  useEffect(() => {
    if (authLoading) return;

    if (token) {
      setState('loading');
      fetch(`/api/public/bookings/${token}`)
        .then(r => r.json())
        .then(data => {
          if (data.error) { setError(data.error); setState('error'); return; }
          setBooking(data.booking);
          setAlternatives(data.alternatives);
          setLocked(data.locked);
          setHoursUntil(data.hoursUntilSession);
          setState('view');
        })
        .catch(() => { setError('Något gick fel. Försök igen.'); setState('error'); });
    } else if (bookingIdParam && user) {
      setState('loading');
      fetch(`/api/student/bookings/${bookingIdParam}/change`)
        .then(r => r.json())
        .then(data => {
          if (data.error) { setError(data.error); setState('error'); return; }
          setBooking(data.booking);
          setAlternatives(data.alternatives);
          setLocked(data.locked);
          setHoursUntil(data.hoursUntilSession);
          setState('view');
        })
        .catch(() => { setError('Något gick fel. Försök igen.'); setState('error'); });
    } else if (!authLoading && !token) {
      setState('email-form');
    }
  }, [token, bookingIdParam, user, authLoading]);

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailSending(true);
    await fetch('/api/public/booking-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    }).catch(() => {});
    setEmailSending(false);
    setState('email-sent');
  };

  const handleChangeSession = async () => {
    if (!selectedSession) return;
    setConfirming(true);
    setError('');

    let res: Response;
    if (token) {
      res = await fetch('/api/public/bookings/change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newSessionId: selectedSession.id }),
      });
    } else {
      res = await fetch(`/api/student/bookings/${bookingIdParam}/change`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newSessionId: selectedSession.id }),
      });
    }

    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Något gick fel. Försök igen.');
      setConfirming(false);
      return;
    }
    setSuccessSession(selectedSession);
    setState('success');
    setConfirming(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />
      <main className="flex-1 py-10">
        <div className="max-w-xl mx-auto px-4">

          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-14 h-14 bg-swedish-blue/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-7 h-7 text-swedish-blue" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Byt kurstillfälle</h1>
            <p className="text-gray-500 text-sm mt-1">Flytta din bokning till ett annat ledigt tillfälle</p>
          </div>

          {/* Loading */}
          {(state === 'idle' || state === 'loading') && (
            <div className="text-center py-16">
              <div className="w-8 h-8 border-2 border-swedish-blue border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          )}

          {/* Email form */}
          {state === 'email-form' && (
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <h2 className="font-bold text-gray-900 mb-1">Hitta din bokning</h2>
              <p className="text-gray-500 text-sm mb-5">
                Ange den e-postadress du bokade med så skickar vi en länk för att byta tid.
              </p>
              <form onSubmit={handleSendEmail} className="space-y-4">
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="din@email.com"
                  required
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-swedish-blue/30 focus:border-swedish-blue"
                />
                <button
                  type="submit"
                  disabled={emailSending}
                  className="w-full bg-swedish-blue text-white font-bold py-3 rounded-xl hover:bg-swedish-dark transition disabled:opacity-60"
                >
                  {emailSending ? 'Skickar...' : 'Skicka länk'}
                </button>
              </form>
            </div>
          )}

          {/* Email sent */}
          {state === 'email-sent' && (
            <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm text-center">
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-7 h-7 text-green-600" />
              </div>
              <h2 className="font-bold text-gray-900 mb-2">Kolla din e-post!</h2>
              <p className="text-gray-500 text-sm">
                Om vi hittar en bokning kopplad till <strong>{email}</strong> skickar vi en länk inom några minuter.
              </p>
              <button
                onClick={() => setState('email-form')}
                className="mt-5 text-sm text-swedish-blue hover:underline"
              >
                Prova en annan adress
              </button>
            </div>
          )}

          {/* Booking view */}
          {state === 'view' && booking && (
            <div className="space-y-5">

              {/* Current booking */}
              <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Din nuvarande tid</p>
                <p className="font-bold text-gray-900 mb-2">
                  {booking.session.course.titleSv} ({booking.session.course.behorighet})
                </p>
                <div className="flex flex-col gap-1.5 text-sm text-gray-600">
                  <span className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
                    {formatDate(booking.session.startTime)}
                  </span>
                  <span className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-gray-400 shrink-0" />
                    {formatTime(booking.session.startTime, booking.session.endTime)}
                  </span>
                  {(booking.session.course.location || booking.session.school?.name) && (
                    <span className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-gray-400 shrink-0" />
                      {booking.session.course.location || booking.session.school?.name}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-3">Bokning #{booking.id}</p>
              </div>

              {/* Locked */}
              {locked && (
                <div className="bg-orange-50 border border-orange-200 rounded-2xl p-6 text-center">
                  <Lock className="w-8 h-8 text-orange-400 mx-auto mb-3" />
                  <h2 className="font-bold text-orange-800 mb-1">Tidsbyte är låst</h2>
                  <p className="text-orange-700 text-sm">
                    Tidsbyte är inte möjligt inom {LOCK_HOURS} timmar innan kursen.
                    Det är {hoursUntil} {hoursUntil === 1 ? 'timme' : 'timmar'} kvar till ditt tillfälle.
                  </p>
                </div>
              )}

              {/* Alternatives */}
              {!locked && (
                <>
                  {alternatives.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm text-center">
                      <p className="text-gray-500 text-sm font-medium">Inga andra lediga tillfällen just nu.</p>
                      <p className="text-gray-400 text-xs mt-1">Nya tillfällen läggs till löpande — kolla igen senare.</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-semibold text-gray-700 mb-3">
                        Välj ett nytt tillfälle
                        <span className="text-gray-400 font-normal ml-1">({alternatives.length} lediga)</span>
                      </p>
                      <div className="space-y-2">
                        {alternatives.map(session => {
                          const isSelected = selectedSession?.id === session.id;
                          const isLow = session.seatsAvailable <= 3;
                          const start = new Date(session.startTime);
                          return (
                            <button
                              key={session.id}
                              onClick={() => setSelectedSession(isSelected ? null : session)}
                              className={clsx(
                                'w-full text-left bg-white rounded-xl border p-4 transition hover:shadow-sm',
                                isSelected
                                  ? 'border-swedish-blue ring-2 ring-swedish-blue/20'
                                  : 'border-gray-100 hover:border-gray-200',
                              )}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                  {/* Calendar badge */}
                                  <div className="w-9 h-10 rounded-lg overflow-hidden flex flex-col shrink-0 shadow-sm border border-gray-100">
                                    <div className={clsx(
                                      'h-3.5 flex items-center justify-center',
                                      session.course.type === 'Risk1' ? 'bg-swedish-blue' :
                                      session.course.type === 'Combo' ? 'bg-purple-600' : 'bg-orange-400',
                                    )}>
                                      <span className="text-[8px] font-bold text-white uppercase tracking-wide">
                                        {start.toLocaleDateString('sv-SE', { month: 'short', timeZone: 'Europe/Stockholm' }).replace('.', '')}
                                      </span>
                                    </div>
                                    <div className="flex-1 bg-white flex items-center justify-center">
                                      <span className="text-sm font-bold text-gray-900 leading-none">{start.getDate()}</span>
                                    </div>
                                  </div>

                                  <div className="min-w-0 flex-1">
                                    <p className="font-semibold text-gray-900 text-sm">{formatDate(session.startTime)}</p>
                                    <div className="flex gap-3 text-xs text-gray-500 mt-0.5 flex-wrap">
                                      <span className="flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        {formatTime(session.startTime, session.endTime)}
                                      </span>
                                      {(session.course.location || session.school?.name) && (
                                        <span className="flex items-center gap-1">
                                          <MapPin className="w-3 h-3" />
                                          {session.course.location || session.school?.name}
                                        </span>
                                      )}
                                      <span className={clsx(
                                        'flex items-center gap-1 font-semibold',
                                        isLow ? 'text-orange-500' : 'text-gray-400',
                                      )}>
                                        <Users className="w-3 h-3" />
                                        {isLow
                                          ? `${session.seatsAvailable} platser kvar`
                                          : `${session.seatsAvailable}/${session.seatLimit} kvar`}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {isSelected && (
                                  <CheckCircle2 className="w-5 h-5 text-swedish-blue shrink-0 mt-0.5" />
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Confirm panel */}
                  {selectedSession && (
                    <div className="bg-swedish-blue/5 border border-swedish-blue/20 rounded-2xl p-5">
                      <p className="text-sm font-semibold text-gray-800 mb-1">Bekräfta tidsbyte</p>
                      <p className="text-sm text-gray-600 mb-4">
                        Du byter till{' '}
                        <strong>{formatDate(selectedSession.startTime)}</strong>,{' '}
                        {formatTime(selectedSession.startTime, selectedSession.endTime)}.
                        En bekräftelse skickas till din e-postadress.
                      </p>
                      {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
                      <div className="flex gap-3">
                        <button
                          onClick={() => { setSelectedSession(null); setError(''); }}
                          className="flex-1 border border-gray-200 text-gray-700 font-semibold py-2.5 rounded-xl hover:bg-gray-50 transition text-sm"
                        >
                          Avbryt
                        </button>
                        <button
                          onClick={handleChangeSession}
                          disabled={confirming}
                          className="flex-1 bg-swedish-blue text-white font-bold py-2.5 rounded-xl hover:bg-swedish-dark transition disabled:opacity-60 text-sm"
                        >
                          {confirming ? 'Byter...' : 'Bekräfta byte'}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Success */}
          {state === 'success' && successSession && (
            <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm text-center">
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-7 h-7 text-green-600" />
              </div>
              <h2 className="font-bold text-gray-900 mb-2">Tidsbyte bekräftat!</h2>
              <p className="text-gray-500 text-sm">
                Du är nu bokad på{' '}
                <strong>{formatDate(successSession.startTime)}</strong>,{' '}
                {formatTime(successSession.startTime, successSession.endTime)}.
                En bekräftelse har skickats till din e-post.
              </p>
            </div>
          )}

          {/* Error */}
          {state === 'error' && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
              <h2 className="font-bold text-red-800 mb-2">Något gick fel</h2>
              <p className="text-red-700 text-sm">{error}</p>
              <button
                onClick={() => { setState('email-form'); setError(''); }}
                className="mt-4 text-sm text-swedish-blue hover:underline inline-flex items-center gap-1"
              >
                <ArrowLeft className="w-4 h-4" /> Gå tillbaka
              </button>
            </div>
          )}

        </div>
      </main>
      <Footer />
    </div>
  );
}

export default function BytTidPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-swedish-blue border-t-transparent rounded-full animate-spin" />
        </main>
        <Footer />
      </div>
    }>
      <BytTidContent />
    </Suspense>
  );
}
