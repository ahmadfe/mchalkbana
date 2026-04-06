'use client';

import { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import type { Booking } from '@/lib/types';
import {
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  XCircle,
  AlertCircle,
  BookOpen,
  ChevronRight,
} from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '@/context/AuthContext';

export default function DashboardPage() {
  const t = useTranslations('dashboard');
  const locale = useLocale();
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelTarget, setCancelTarget] = useState<number | null>(null);
  const [canceling, setCanceling] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push(`/${locale}/login`);
      return;
    }
    if (user) {
      fetch('/api/bookings')
        .then((r) => r.json())
        .then((data) => { setBookings(data.bookings || []); setLoading(false); })
        .catch(() => setLoading(false));
    }
  }, [user, authLoading, locale, router]);

  const upcoming = bookings.filter(
    (b) => b.status !== 'Canceled' && new Date(b.session!.startTime) > new Date()
  );
  const past = bookings.filter(
    (b) => b.status !== 'Canceled' && new Date(b.session!.startTime) <= new Date()
  );
  const canceled = bookings.filter((b) => b.status === 'Canceled');

  const handleCancel = async (id: number) => {
    setCanceling(true);
    const res = await fetch(`/api/bookings/${id}`, { method: 'PATCH' });
    if (res.ok) {
      setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status: 'Canceled' } : b)));
    }
    setCanceling(false);
    setCancelTarget(null);
  };

  const StatusBadge = ({ status }: { status: Booking['status'] }) => {
    const config = {
      Paid: { icon: <CheckCircle2 className="w-3.5 h-3.5" />, label: t('paid'), cls: 'bg-green-100 text-green-700' },
      Pending: { icon: <AlertCircle className="w-3.5 h-3.5" />, label: t('pending'), cls: 'bg-yellow-100 text-yellow-700' },
      Canceled: { icon: <XCircle className="w-3.5 h-3.5" />, label: t('canceled'), cls: 'bg-red-100 text-red-700' },
    }[status];
    return (
      <span className={clsx('inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full', config.cls)}>
        {config.icon}
        {config.label}
      </span>
    );
  };

  const BookingRow = ({ booking }: { booking: Booking }) => {
    const session = booking.session!;
    const course = session.course!;
    const title = locale === 'sv' ? course.titleSv : course.titleEn;
    const start = new Date(session.startTime);
    const dateStr = start.toLocaleDateString(locale === 'sv' ? 'sv-SE' : 'en-GB', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
    const timeStr = start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const isFuture = start > new Date();

    return (
      <div className="bg-white rounded-xl border border-gray-100 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className={clsx(
            'w-10 h-10 rounded-lg flex items-center justify-center shrink-0 font-bold text-sm',
            course.type === 'Risk1' ? 'bg-blue-100 text-swedish-blue' : 'bg-orange-100 text-orange-700'
          )}>
            {course.type === 'Risk1' ? 'R1' : 'R2'}
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-sm">{title}</p>
            <div className="flex flex-wrap gap-3 mt-1">
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <Calendar className="w-3.5 h-3.5" /> {dateStr}
              </span>
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <Clock className="w-3.5 h-3.5" /> {timeStr}
              </span>
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <MapPin className="w-3.5 h-3.5" /> {session.school?.name}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-1">#{booking.id}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <StatusBadge status={booking.status} />
          {isFuture && booking.status !== 'Canceled' && (
            <button
              onClick={() => setCancelTarget(booking.id)}
              className="text-xs text-red-600 hover:underline font-medium"
            >
              {t('cancel')}
            </button>
          )}
        </div>
      </div>
    );
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

      <main className="flex-1 py-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900">{t('welcome', { name: user?.name || '' })}</h1>
            <p className="text-gray-500 text-sm mt-1">{user?.email}</p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Totala bokningar', value: bookings.length, color: 'text-swedish-blue' },
              { label: 'Kommande', value: upcoming.length, color: 'text-green-600' },
              { label: 'Avbokade', value: canceled.length, color: 'text-red-500' },
              { label: 'Genomförda', value: past.length, color: 'text-gray-600' },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-4 text-center">
                <div className={clsx('text-3xl font-bold', s.color)}>{s.value}</div>
                <div className="text-xs text-gray-500 mt-1">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Upcoming bookings */}
          <section className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg text-gray-900">{t('upcoming')}</h2>
              <Link href={`/${locale}/courses`} className="text-sm text-swedish-blue hover:underline flex items-center gap-1">
                Boka ny kurs <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            {upcoming.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
                <BookOpen className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-400 text-sm">{t('no_upcoming')}</p>
                <Link href={`/${locale}/courses`} className="btn-primary inline-block mt-4 text-sm">
                  Boka en kurs
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {upcoming.map((b) => <BookingRow key={b.id} booking={b} />)}
              </div>
            )}
          </section>

          {/* Past bookings */}
          <section>
            <h2 className="font-bold text-lg text-gray-900 mb-4">{t('past')}</h2>
            {past.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-100 p-6 text-center">
                <p className="text-gray-400 text-sm">{t('no_past')}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {past.map((b) => <BookingRow key={b.id} booking={b} />)}
              </div>
            )}
          </section>
        </div>
      </main>

      {/* Cancel confirmation modal */}
      {cancelTarget !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="text-center font-bold text-gray-900 mb-2">Avboka kurs?</h3>
            <p className="text-center text-gray-500 text-sm mb-6">{t('cancel_confirm')}</p>
            <div className="flex gap-3">
              <button
                onClick={() => setCancelTarget(null)}
                className="flex-1 border border-gray-200 text-gray-700 font-medium py-2.5 rounded-xl hover:bg-gray-50 transition"
              >
                {t('no')}
              </button>
              <button
                onClick={() => handleCancel(cancelTarget)}
                disabled={canceling}
                className="flex-1 bg-red-600 text-white font-medium py-2.5 rounded-xl hover:bg-red-700 transition disabled:opacity-60"
              >
                {canceling ? 'Avbokar...' : t('yes')}
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
