'use client';

import { useTranslations, useLocale } from 'next-intl';
import Link from 'next/link';
import { Calendar, Clock, MapPin, Users } from 'lucide-react';
import type { Session } from '@/lib/types';
import clsx from 'clsx';

interface Props {
  session: Session;
  isLoggedIn?: boolean;
}

export default function SessionCard({ session, isLoggedIn }: Props) {
  const t = useTranslations('courses');
  const locale = useLocale();

  const course = session.course!;
  const title = locale === 'sv' ? course.titleSv : course.titleEn;
  const start = new Date(session.startTime);
  const end = new Date(session.endTime);
  const isSoldOut = session.seatsAvailable === 0;

  const dateStr = start.toLocaleDateString(locale === 'sv' ? 'sv-SE' : 'en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Stockholm',
  });

  const timeStr = `${start.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Stockholm' })} – ${end.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Stockholm' })}`;

  const typeColor = course.type === 'Risk1'
    ? 'bg-brand-100 text-brand-800'
    : 'bg-orange-100 text-orange-800';

  const vehicleColor = course.vehicle === 'Car'
    ? 'bg-gray-100 text-gray-700'
    : 'bg-purple-100 text-purple-700';

  const seatPct = session.seatsAvailable / session.seatLimit;
  const seatColor = seatPct === 0 ? 'bg-red-500' : seatPct < 0.3 ? 'bg-yellow-500' : 'bg-green-500';

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-md hover:border-brand-200 transition-all overflow-hidden">
      {/* Top color bar */}
      <div className={clsx('h-1', course.type === 'Risk1' ? 'bg-swedish-blue' : 'bg-orange-500')} />

      <div className="p-5">
        {/* Badges */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className={clsx('text-xs font-semibold px-2.5 py-0.5 rounded-full', typeColor)}>
            {course.type === 'Risk1' ? t('risk1') : t('risk2')}
          </span>
          <span className={clsx('text-xs font-semibold px-2.5 py-0.5 rounded-full', vehicleColor)}>
            {course.vehicle === 'Car' ? t('car') : t('motorcycle')}
          </span>
          <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-swedish-blue/10 text-swedish-blue">
            Behörighet {course.behorighet}
          </span>
        </div>

        <h3 className="font-bold text-gray-900 text-lg mb-1">{title}</h3>
        <p className="text-sm text-gray-500 mb-4 leading-relaxed">{course.description}</p>

        {/* Details */}
        <div className="space-y-1.5 mb-4">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
            <span>{dateStr}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Clock className="w-4 h-4 text-gray-400 shrink-0" />
            <span>{timeStr}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <MapPin className="w-4 h-4 text-gray-400 shrink-0" />
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(course.location || session.school?.name || '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-swedish-blue hover:underline"
            >
              {course.location || session.school?.name}
            </a>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Users className="w-4 h-4 text-gray-400 shrink-0" />
            <span>
              {isSoldOut ? (
                <span className="text-red-600 font-semibold">{t('sold_out')}</span>
              ) : (
                <span>{session.seatsAvailable} / {session.seatLimit} {t('available')}</span>
              )}
            </span>
          </div>
        </div>

        {/* Seat progress bar */}
        <div className="h-1.5 bg-gray-100 rounded-full mb-4">
          <div
            className={clsx('h-full rounded-full transition-all', seatColor)}
            style={{ width: `${((session.seatLimit - session.seatsAvailable) / session.seatLimit) * 100}%` }}
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between">
          <span className="text-xl font-bold text-gray-900">
            {course.price.toLocaleString('sv-SE')} <span className="text-sm font-normal text-gray-500">kr</span>
          </span>

          {isSoldOut ? (
            <button disabled className="bg-gray-100 text-gray-400 text-sm font-medium px-5 py-2 rounded-xl cursor-not-allowed">
              {t('sold_out')}
            </button>
          ) : (
            <Link
              href={`/${locale}/checkout?session=${session.id}`}
              className="bg-swedish-yellow text-gray-900 text-sm font-semibold px-5 py-2 rounded-xl hover:bg-yellow-300 transition shadow-sm shadow-swedish-yellow/30"
            >
              {t('book_session')}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
