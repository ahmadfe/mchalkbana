'use client';

import { useState, useEffect, Suspense } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import type { Session } from '@/lib/types';
import { CheckCircle2, CreditCard, Smartphone, AlertTriangle, Lock, ArrowLeft } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '@/context/AuthContext';

type PaymentMethod = 'card' | 'swish' | 'apple_pay';
type CheckoutStep = 'payment' | 'processing' | 'success' | 'failed';

function CheckoutContent() {
  const t = useTranslations('checkout');
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading: authLoading } = useAuth();
  const sessionId = parseInt(searchParams.get('session') || '1');

  const [session, setSession] = useState<Session | null>(null);
  const [bookingId, setBookingId] = useState<number | null>(null);
  const [method, setMethod] = useState<PaymentMethod>('card');
  const [step, setStep] = useState<CheckoutStep>('payment');
  const [card, setCard] = useState({ number: '', name: '', expiry: '', cvv: '' });
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/sessions/${sessionId}`)
      .then((r) => r.json())
      .then((data) => setSession(data.session));
  }, [sessionId]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push(`/${locale}/login`);
    }
  }, [user, authLoading, locale, router]);

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
  const start = new Date(session.startTime);
  const dateStr = start.toLocaleDateString(locale === 'sv' ? 'sv-SE' : 'en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  const timeStr = start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setStep('processing');

    // Step 1: Create booking
    const bookRes = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    });

    if (!bookRes.ok) {
      const data = await bookRes.json();
      setError(data.error || 'Bokning misslyckades');
      setStep('failed');
      return;
    }

    const bookData = await bookRes.json();
    const newBookingId = bookData.booking.id;
    setBookingId(newBookingId);

    // Step 2: Process payment
    const payRes = await fetch(`/api/bookings/${newBookingId}/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: method === 'card' ? 'Stripe' : method === 'swish' ? 'Swish' : 'ApplePay' }),
    });

    if (payRes.ok) {
      setStep('success');
    } else {
      setStep('failed');
    }
  };

  const methods: { id: PaymentMethod; label: string; icon: React.ReactNode; desc: string }[] = [
    { id: 'card', label: t('card'), icon: <CreditCard className="w-5 h-5" />, desc: 'Visa, Mastercard, Amex' },
    { id: 'swish', label: t('swish'), icon: <Smartphone className="w-5 h-5" />, desc: 'Swish – populärt i Sverige' },
    { id: 'apple_pay', label: t('apple_pay'), icon: <span className="text-lg"></span>, desc: 'Snabb betalning med Apple Pay' },
  ];

  if (step === 'processing') {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-20 h-20 border-4 border-swedish-blue border-t-transparent rounded-full animate-spin mx-auto mb-6" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">{t('processing')}</h2>
            <p className="text-gray-500 text-sm">Ansluter till betalning...</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (step === 'success') {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Navbar />
        <main className="flex-1 flex items-center justify-center py-12 px-4">
          <div className="w-full max-w-md text-center">
            <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-12 h-12 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('success_title')}</h1>
            <p className="text-gray-500 mb-2">{t('success_msg', { email: user?.email || '' })}</p>

            <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-6 text-left mt-6">
              <h3 className="font-semibold text-gray-900 mb-3">Bokningsdetaljer</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Kurs:</span>
                  <span className="font-medium">{title}</span>
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
                  <span className="font-medium">{session.school?.name}</span>
                </div>
                {bookingId && (
                  <div className="flex justify-between text-xs text-gray-400 pt-1">
                    <span>Boknings-ID:</span>
                    <span>#{bookingId}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-gray-100 pt-2 mt-2">
                  <span className="font-semibold">Totalt:</span>
                  <span className="font-bold text-swedish-blue">{course.price.toLocaleString('sv-SE')} kr</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Link href={`/${locale}/dashboard`} className="flex-1 btn-primary py-3 text-center">
                Mina bokningar
              </Link>
              <Link href={`/${locale}/courses`} className="flex-1 btn-outline py-3 text-center">
                Fler kurser
              </Link>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (step === 'failed') {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Navbar />
        <main className="flex-1 flex items-center justify-center py-12 px-4">
          <div className="w-full max-w-md text-center">
            <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-12 h-12 text-red-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('failed_title')}</h1>
            <p className="text-gray-500 mb-2">{error || t('failed_msg')}</p>
            <div className="flex gap-3 justify-center mt-6">
              <button onClick={() => setStep('payment')} className="btn-primary px-8 py-3">
                {t('retry')}
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

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />

      <main className="flex-1 py-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link href={`/${locale}/courses`} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-8">
            <ArrowLeft className="w-4 h-4" />
            Tillbaka till kurser
          </Link>

          <h1 className="text-2xl font-bold text-gray-900 mb-8">{t('title')}</h1>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
            {/* Left: Payment form */}
            <form onSubmit={handlePay} className="lg:col-span-3 space-y-6">
              {/* Payment method selector */}
              <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <h2 className="font-semibold text-gray-900 mb-4">{t('pay_with')}</h2>
                <div className="space-y-2">
                  {methods.map((m) => (
                    <label
                      key={m.id}
                      className={clsx(
                        'flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition',
                        method === m.id ? 'border-swedish-blue bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                      )}
                    >
                      <input
                        type="radio"
                        name="method"
                        value={m.id}
                        checked={method === m.id}
                        onChange={() => setMethod(m.id)}
                        className="sr-only"
                      />
                      <div className={clsx(
                        'w-10 h-10 rounded-lg flex items-center justify-center',
                        method === m.id ? 'bg-swedish-blue text-white' : 'bg-gray-100 text-gray-500'
                      )}>
                        {m.icon}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{m.label}</p>
                        <p className="text-xs text-gray-500">{m.desc}</p>
                      </div>
                      <div className={clsx(
                        'ml-auto w-5 h-5 rounded-full border-2 flex items-center justify-center',
                        method === m.id ? 'border-swedish-blue' : 'border-gray-300'
                      )}>
                        {method === m.id && <div className="w-2.5 h-2.5 bg-swedish-blue rounded-full" />}
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Card details */}
              {method === 'card' && (
                <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
                  <h2 className="font-semibold text-gray-900">Kortuppgifter</h2>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Kortnummer</label>
                    <input
                      type="text"
                      value={card.number}
                      onChange={(e) => setCard({ ...card, number: e.target.value })}
                      className="input-field font-mono"
                      placeholder="1234 5678 9012 3456"
                      maxLength={19}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Namn på kort</label>
                    <input
                      type="text"
                      value={card.name}
                      onChange={(e) => setCard({ ...card, name: e.target.value })}
                      className="input-field"
                      placeholder="ANNA SVENSSON"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Utgångsdatum</label>
                      <input
                        type="text"
                        value={card.expiry}
                        onChange={(e) => setCard({ ...card, expiry: e.target.value })}
                        className="input-field"
                        placeholder="MM/ÅÅ"
                        maxLength={5}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">CVV</label>
                      <input
                        type="text"
                        value={card.cvv}
                        onChange={(e) => setCard({ ...card, cvv: e.target.value })}
                        className="input-field"
                        placeholder="123"
                        maxLength={4}
                      />
                    </div>
                  </div>
                </div>
              )}

              {method === 'swish' && (
                <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
                  <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Smartphone className="w-10 h-10 text-white" />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">Betala med Swish</h3>
                  <p className="text-gray-500 text-sm">Klicka på &quot;Betala&quot; så öppnas Swish-appen automatiskt.</p>
                </div>
              )}

              {method === 'apple_pay' && (
                <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
                  <div className="w-20 h-20 bg-black rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <span className="text-white text-3xl"></span>
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">Betala med Apple Pay</h3>
                  <p className="text-gray-500 text-sm">Klicka på &quot;Betala&quot; för att autentisera med Face ID.</p>
                </div>
              )}

              {/* Security notice */}
              <div className="flex items-center gap-3 text-xs text-gray-400 bg-gray-50 rounded-xl p-3">
                <Lock className="w-4 h-4 shrink-0" />
                <p>Din betalning är krypterad och hanteras säkert. Vi lagrar aldrig kortuppgifter.</p>
              </div>

              <button
                type="submit"
                className="w-full bg-swedish-blue text-white font-bold text-lg py-4 rounded-xl hover:bg-blue-700 transition flex items-center justify-center gap-2"
              >
                <Lock className="w-5 h-5" />
                {t('pay_btn', { amount: course.price.toLocaleString('sv-SE') })}
              </button>
            </form>

            {/* Right: Booking summary */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-2xl border border-gray-100 p-5 sticky top-24">
                <h2 className="font-semibold text-gray-900 mb-4">{t('summary')}</h2>

                <div className={clsx(
                  'w-full h-1.5 rounded-full mb-5',
                  course.type === 'Risk1' ? 'bg-swedish-blue' : 'bg-orange-500'
                )} />

                <div className="space-y-3 text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="text-gray-500">{t('course')}:</span>
                    <span className="font-medium text-right">{title}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-gray-500">{t('date')}:</span>
                    <span className="font-medium text-right">{dateStr}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-gray-500">Tid:</span>
                    <span className="font-medium">{timeStr}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-gray-500">{t('location')}:</span>
                    <span className="font-medium text-right">{session.school?.name}</span>
                  </div>
                </div>

                <div className="border-t border-gray-100 mt-5 pt-4">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-500">Kursavgift</span>
                    <span>{course.price.toLocaleString('sv-SE')} kr</span>
                  </div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-500">Moms (25%)</span>
                    <span>Inkl.</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg pt-2 border-t border-gray-100">
                    <span>{t('total')}:</span>
                    <span className="text-swedish-blue">{course.price.toLocaleString('sv-SE')} kr</span>
                  </div>
                </div>

                <div className="mt-5 p-3 bg-gray-50 rounded-xl text-center">
                  <p className="text-xs text-gray-400">Säker betalning via</p>
                  <p className="font-bold text-gray-700 text-sm">Stripe</p>
                  <p className="text-xs text-gray-400 mt-1">PCI-DSS Level 1 certifierad</p>
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
