'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useLocale } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import type { Session } from '@/lib/types';
import { CheckCircle2, Smartphone, AlertTriangle, Lock, ArrowLeft, User, Clock, QrCode } from 'lucide-react';
import clsx from 'clsx';
import { QRCodeSVG } from 'qrcode.react';

type CheckoutStep = 'form' | 'waiting' | 'success' | 'failed';

interface GuestInfo {
  name: string;
  personnummer: string;
  phone: string;      // contact phone
  email: string;
  swishPhone: string; // Swish phone number
}

function CheckoutContent() {
  const locale = useLocale();
  const searchParams = useSearchParams();
  const sessionId = parseInt(searchParams.get('session') || '0');

  const [session, setSession] = useState<Session | null>(null);
  const [bookingId, setBookingId] = useState<number | null>(null);
  const [swishRequestId, setSwishRequestId] = useState<string | null>(null);
  const [step, setStep] = useState<CheckoutStep>('form');
  const [guest, setGuest] = useState<GuestInfo>({
    name: '', personnummer: '', phone: '', email: '', swishPhone: '',
  });
  const [guestErrors, setGuestErrors] = useState<Partial<GuestInfo>>({});
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch(`/api/sessions/${sessionId}`)
      .then((r) => r.json())
      .then((d) => setSession(d.session));
  }, [sessionId]);

  // Poll booking status while waiting
  useEffect(() => {
    if (step !== 'waiting' || !bookingId) return;

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/bookings/${bookingId}/status`);
        const data = await res.json();
        if (data.status === 'Paid') {
          clearInterval(pollRef.current!);
          setStep('success');
        } else if (data.status === 'Canceled') {
          clearInterval(pollRef.current!);
          setError('Betalning avvisades eller tog för lång tid. Försök igen.');
          setStep('failed');
        }
      } catch {
        // ignore transient errors, keep polling
      }
    }, 2000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [step, bookingId]);

  if (!session) {
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

  const course = session.course!;
  const title = locale === 'sv' ? course.titleSv : course.titleEn;
  const courseSubtitle = course.vehicle === 'Car' ? 'Bil 🚗' : course.vehicle === 'Motorcycle' ? 'Motorcykel 🏍️' : course.vehicle;
  const start = new Date(session.startTime);
  const end = new Date(session.endTime);
  const dateStr = start.toLocaleDateString(locale === 'sv' ? 'sv-SE' : 'en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  const startStr = start.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
  const endStr = end.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
  const timeStr = `${startStr} – ${endStr}`;

  const validate = (): boolean => {
    const errs: Partial<GuestInfo> = {};
    if (!guest.name.trim()) errs.name = 'Namn krävs';
    if (!guest.personnummer.trim()) errs.personnummer = 'Personnummer krävs';
    else if (!/^\d{6,8}[-]?\d{4}$/.test(guest.personnummer.replace(/\s/g, '')))
      errs.personnummer = 'Format: YYYYMMDD-XXXX';
    if (!guest.email.includes('@')) errs.email = 'Ogiltig e-postadress';
    if (!guest.swishPhone.trim()) errs.swishPhone = 'Swish-nummer krävs';
    else if (!/^(\+?46|0)[0-9\s\-]{7,12}$/.test(guest.swishPhone.trim()))
      errs.swishPhone = 'Ange ett giltigt mobilnummer';
    setGuestErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    setError('');

    // 1. Create booking
    const bookRes = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        guestName: guest.name,
        personnummer: guest.personnummer,
        guestPhone: guest.phone || null,
        guestEmail: guest.email,
      }),
    });

    if (!bookRes.ok) {
      const d = await bookRes.json();
      setError(d.error ?? 'Bokning misslyckades');
      setSubmitting(false);
      return;
    }

    const { booking } = await bookRes.json();
    setBookingId(booking.id);

    // 2. Create Swish payment request
    const swishRes = await fetch('/api/swish/create-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingId: booking.id, payerPhone: guest.swishPhone }),
    });

    if (!swishRes.ok) {
      const d = await swishRes.json();
      setError(d.error ?? 'Swish-betalning misslyckades');
      setSubmitting(false);
      return;
    }

    const swishData = await swishRes.json();
    setSwishRequestId(swishData.swishRequestId ?? null);

    // 3. Enter waiting state — polling starts via useEffect
    setSubmitting(false);
    setStep('waiting');
  };

  // ── Waiting state ──────────────────────────────────────────────────────────
  if (step === 'waiting') {
    const swishDeepLink = swishRequestId
      ? `swish://paymentrequest?token=${swishRequestId}&callbackurl=${encodeURIComponent(typeof window !== 'undefined' ? window.location.href : '')}`
      : null;

    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Navbar />
        <main className="flex-1 flex items-center justify-center py-12 px-4">
          <div className="w-full max-w-md text-center">
            <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 bg-gradient-to-br from-[#4B0082] via-[#9B59B6] to-[#E91E8C]">
              <Smartphone className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Väntar på Swish</h1>
            <p className="text-gray-500 mb-6">Betala <strong>{course.price.toLocaleString('sv-SE')} kr</strong> för {locale === 'sv' ? course.titleSv : course.titleEn}</p>

            {/* QR code for desktop users */}
            {swishDeepLink && (
              <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4">
                <div className="flex items-center gap-2 justify-center mb-3 text-sm font-medium text-gray-700">
                  <QrCode className="w-4 h-4" />
                  Skanna med din telefon
                </div>
                <div className="flex justify-center mb-3">
                  <div className="p-3 bg-white rounded-xl border-2 border-gray-100 inline-block">
                    <QRCodeSVG
                      value={swishDeepLink}
                      size={180}
                      bgColor="#ffffff"
                      fgColor="#000000"
                      level="M"
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-400">Öppna kameran och skanna QR-koden för att betala i Swish-appen</p>

                {/* Mobile deep link button */}
                <a
                  href={swishDeepLink}
                  className="mt-3 flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-gradient-to-r from-[#4B0082] to-[#E91E8C] text-white text-sm font-semibold sm:hidden"
                >
                  <Smartphone className="w-4 h-4" />
                  Öppna Swish-appen
                </a>
              </div>
            )}

            <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4 text-left">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Eller godkänn i appen</p>
              <ol className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-swedish-blue text-white text-xs flex items-center justify-center shrink-0 mt-0.5">1</span>
                  Öppna Swish-appen på {guest.swishPhone}
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-swedish-blue text-white text-xs flex items-center justify-center shrink-0 mt-0.5">2</span>
                  Godkänn betalningen på <strong>{course.price.toLocaleString('sv-SE')} kr</strong>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-swedish-blue text-white text-xs flex items-center justify-center shrink-0 mt-0.5">3</span>
                  Kvitto skickas till {guest.email}
                </li>
              </ol>
            </div>

            <div className="flex items-center justify-center gap-2 text-sm text-gray-400 mb-3">
              <Clock className="w-4 h-4 animate-pulse" />
              <span>Väntar på godkännande...</span>
              <div className="w-4 h-4 border-2 border-swedish-blue border-t-transparent rounded-full animate-spin" />
            </div>
            <p className="text-xs text-gray-400">Upphör automatiskt efter 3 minuter.</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // ── Success state ──────────────────────────────────────────────────────────
  if (step === 'success') {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Navbar />
        <main className="flex-1 flex items-center justify-center py-12 px-4">
          <div className="w-full max-w-md text-center">
            <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-12 h-12 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Bokning bekräftad!</h1>
            <p className="text-gray-500 mb-2">
              Kvitto skickat till <strong>{guest.email}</strong>
            </p>

            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-6 text-left mt-6">
              <div className="bg-swedish-blue px-5 py-3">
                <h3 className="font-semibold text-white text-sm tracking-wide uppercase">Bokningsdetaljer</h3>
              </div>
              <div className="p-5 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Namn:</span>
                  <span className="font-medium">{guest.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Personnummer:</span>
                  <span className="font-medium">{guest.personnummer}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-gray-500 shrink-0">Kurs:</span>
                  <div className="text-right">
                    <p className="font-medium">{title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{courseSubtitle}</p>
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Datum:</span>
                  <span className="font-medium">{dateStr}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Tid:</span>
                  <span className="font-medium">{timeStr}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Plats:</span>
                  <span className="font-medium">{course.location || session.school?.address || session.school?.name}</span>
                </div>
                {bookingId && (
                  <div className="flex justify-between text-xs text-gray-400 pt-1">
                    <span>Boknings-ID:</span>
                    <span>#{bookingId}</span>
                  </div>
                )}
                {course.receiptMessage && (
                  <div className="flex justify-between gap-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-1">
                    <span className="font-bold text-red-600 shrink-0">OBS!</span>
                    <span className="text-red-600 text-right">{course.receiptMessage}</span>
                  </div>
                )}
                <div className="flex justify-between border-t-2 border-swedish-blue pt-2 mt-2">
                  <span className="font-semibold">Totalt betalt:</span>
                  <span className="font-bold text-swedish-blue text-base">{course.price.toLocaleString('sv-SE')} kr</span>
                </div>
              </div>
            </div>

            <Link href={`/${locale}/courses`} className="btn-primary inline-block px-8 py-3">
              Tillbaka till kurser
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // ── Failed state ───────────────────────────────────────────────────────────
  if (step === 'failed') {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Navbar />
        <main className="flex-1 flex items-center justify-center py-12 px-4">
          <div className="w-full max-w-md text-center">
            <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-12 h-12 text-red-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Betalning misslyckades</h1>
            <p className="text-gray-500 mb-6">{error || 'Något gick fel. Försök igen.'}</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => { setStep('form'); setError(''); }} className="btn-primary px-8 py-3">
                Försök igen
              </button>
              <Link href={`/${locale}/courses`} className="btn-outline px-8 py-3">
                Tillbaka
              </Link>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // ── Form state ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />

      <main className="flex-1 py-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link href={`/${locale}/courses`} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-8">
            <ArrowLeft className="w-4 h-4" />
            Tillbaka till kurser
          </Link>

          <h1 className="text-2xl font-bold text-gray-900 mb-8">Slutför bokning</h1>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
            {/* Left: form */}
            <form onSubmit={handlePay} className="lg:col-span-3 space-y-6">

              {/* Personal details */}
              <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <User className="w-4 h-4 text-swedish-blue" />
                  <h2 className="font-semibold text-gray-900">Dina uppgifter</h2>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Namn *</label>
                  <input
                    type="text"
                    value={guest.name}
                    onChange={(e) => setGuest({ ...guest, name: e.target.value })}
                    placeholder="Anna Svensson"
                    className={clsx('input-field', guestErrors.name && 'border-red-400')}
                  />
                  {guestErrors.name && <p className="text-xs text-red-600 mt-1">{guestErrors.name}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Personnummer *</label>
                  <input
                    type="text"
                    value={guest.personnummer}
                    onChange={(e) => setGuest({ ...guest, personnummer: e.target.value })}
                    placeholder="YYYYMMDD-XXXX"
                    className={clsx('input-field font-mono', guestErrors.personnummer && 'border-red-400')}
                  />
                  {guestErrors.personnummer && <p className="text-xs text-red-600 mt-1">{guestErrors.personnummer}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Telefonnummer <span className="text-gray-400 font-normal">(valfritt)</span></label>
                  <input
                    type="tel"
                    value={guest.phone}
                    onChange={(e) => setGuest({ ...guest, phone: e.target.value })}
                    placeholder="070-123 45 67"
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    E-postadress * <span className="text-gray-400 font-normal">(kvitto skickas hit)</span>
                  </label>
                  <input
                    type="email"
                    value={guest.email}
                    onChange={(e) => setGuest({ ...guest, email: e.target.value })}
                    placeholder="anna@exempel.se"
                    className={clsx('input-field', guestErrors.email && 'border-red-400')}
                  />
                  {guestErrors.email && <p className="text-xs text-red-600 mt-1">{guestErrors.email}</p>}
                </div>
              </div>

              {/* Swish */}
              <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#4B0082] via-[#9B59B6] to-[#E91E8C] flex items-center justify-center">
                    <Smartphone className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-gray-900">Betala med Swish</h2>
                    <p className="text-xs text-gray-400">En betalningsförfrågan skickas till din Swish-app</p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Swish-nummer *</label>
                  <input
                    type="tel"
                    value={guest.swishPhone}
                    onChange={(e) => setGuest({ ...guest, swishPhone: e.target.value })}
                    placeholder="070-123 45 67"
                    className={clsx('input-field', guestErrors.swishPhone && 'border-red-400')}
                  />
                  {guestErrors.swishPhone
                    ? <p className="text-xs text-red-600 mt-1">{guestErrors.swishPhone}</p>
                    : <p className="text-xs text-gray-400 mt-1">Ange det mobilnummer kopplat till ditt Swish-konto</p>
                  }
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="flex items-center gap-3 text-xs text-gray-400 bg-gray-50 rounded-xl p-3">
                <Lock className="w-4 h-4 shrink-0" />
                <p>Betalningen sker säkert via Swish. Vi lagrar aldrig bankuppgifter.</p>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-swedish-yellow text-gray-900 font-bold text-lg py-4 rounded-xl hover:bg-yellow-300 transition flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {submitting ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Smartphone className="w-5 h-5" />
                )}
                {submitting ? 'Skickar...' : `Betala ${course.price.toLocaleString('sv-SE')} kr med Swish`}
              </button>
            </form>

            {/* Right: summary */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-2xl border border-gray-100 p-5 sticky top-24">
                <h2 className="font-semibold text-gray-900 mb-4">Bokningssammanfattning</h2>

                <div className="w-full h-1.5 rounded-full mb-5 bg-swedish-blue" />

                <div className="space-y-3 text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="text-gray-500 shrink-0">Kurs:</span>
                    <div className="text-right">
                      <p className="font-medium">{title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{courseSubtitle}</p>
                    </div>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-gray-500">Datum:</span>
                    <span className="font-medium text-right">{dateStr}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-gray-500">Tid:</span>
                    <span className="font-medium">{timeStr}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-gray-500">Plats:</span>
                    <span className="font-medium text-right">{course.location || session.school?.address || session.school?.name}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-gray-500">Platser kvar:</span>
                    <span className="font-medium">{session.seatsAvailable}</span>
                  </div>
                </div>

                <div className="border-t border-gray-100 mt-5 pt-4">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-500">Kursavgift (exkl. moms)</span>
                    <span>{Math.round(course.price / 1.25).toLocaleString('sv-SE')} kr</span>
                  </div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-500">Moms (25%)</span>
                    <span>{(course.price - Math.round(course.price / 1.25)).toLocaleString('sv-SE')} kr</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg pt-2 border-t border-gray-100">
                    <span>Totalt:</span>
                    <span className="text-swedish-blue">{course.price.toLocaleString('sv-SE')} kr</span>
                  </div>
                </div>

                <div className="mt-5 p-3 bg-gray-50 rounded-xl text-center">
                  <p className="text-xs text-gray-400">Säker betalning via</p>
                  <p className="font-bold text-gray-700 text-sm">Swish</p>
                  <p className="text-xs text-gray-400 mt-1">Sveriges säkraste betaltjänst</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Laddar...</div>}>
      <CheckoutContent />
    </Suspense>
  );
}
