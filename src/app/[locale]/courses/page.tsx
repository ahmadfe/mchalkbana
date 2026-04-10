'use client';

import { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import SessionCard from '@/components/SessionCard';
import type { CourseType, VehicleType, Session } from '@/lib/types';
import { Filter } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '@/context/AuthContext';

export default function CoursesPage() {
  const t = useTranslations('courses');
  const locale = useLocale();
  const { user } = useAuth();

  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<CourseType | 'All'>('All');
  const [vehicleFilter, setVehicleFilter] = useState<VehicleType | 'All'>('All');
  const [showAvailableOnly, setShowAvailableOnly] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams();
    if (typeFilter !== 'All') params.set('type', typeFilter);
    if (vehicleFilter !== 'All') params.set('vehicle', vehicleFilter);
    if (showAvailableOnly) params.set('availableOnly', 'true');

    setLoading(true);
    fetch(`/api/sessions?${params}`)
      .then((r) => r.json())
      .then((data) => { setSessions(data.sessions || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [typeFilter, vehicleFilter, showAvailableOnly]);

  const FilterBtn = ({
    active,
    onClick,
    children,
  }: {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
  }) => (
    <button
      onClick={onClick}
      className={clsx(
        'px-4 py-2 text-sm font-medium rounded-xl border transition',
        active
          ? 'bg-swedish-blue text-white border-swedish-blue'
          : 'bg-white text-gray-600 border-gray-200 hover:border-swedish-blue hover:text-swedish-blue'
      )}
    >
      {children}
    </button>
  );

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      {/* Header */}
      <section className="bg-gradient-to-r from-swedish-blue to-brand-700 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl md:text-4xl font-extrabold mb-2">{t('title')}</h1>
          <p className="text-brand-100 text-lg">{t('subtitle')}</p>
        </div>
      </section>

      <main className="flex-1 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Filters */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-8">
            <div className="flex items-center gap-2 text-gray-600 mb-4">
              <Filter className="w-4 h-4" />
              <span className="font-medium text-sm">Filter</span>
            </div>
            <div className="flex flex-wrap gap-3">
              {/* Type filter */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">
                  {t('filter_type')}:
                </span>
                <FilterBtn active={typeFilter === 'All'} onClick={() => setTypeFilter('All')}>
                  {t('all')}
                </FilterBtn>
                <FilterBtn active={typeFilter === 'Risk1'} onClick={() => setTypeFilter('Risk1')}>
                  {t('risk1')}
                </FilterBtn>
                <FilterBtn active={typeFilter === 'Risk2'} onClick={() => setTypeFilter('Risk2')}>
                  {t('risk2')}
                </FilterBtn>
              </div>

              <div className="w-px bg-gray-200 self-stretch hidden sm:block" />

              {/* Vehicle filter */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">
                  {t('filter_vehicle')}:
                </span>
                <FilterBtn active={vehicleFilter === 'All'} onClick={() => setVehicleFilter('All')}>
                  {t('all')}
                </FilterBtn>
                <FilterBtn active={vehicleFilter === 'Car'} onClick={() => setVehicleFilter('Car')}>
                  {t('car')} 🚗
                </FilterBtn>
                <FilterBtn active={vehicleFilter === 'Motorcycle'} onClick={() => setVehicleFilter('Motorcycle')}>
                  {t('motorcycle')} 🏍️
                </FilterBtn>
              </div>

              <div className="w-px bg-gray-200 self-stretch hidden sm:block" />

              {/* Available only toggle */}
              <label className="flex items-center gap-2 cursor-pointer">
                <div
                  onClick={() => setShowAvailableOnly(!showAvailableOnly)}
                  className={clsx(
                    'relative w-10 h-5 rounded-full transition cursor-pointer',
                    showAvailableOnly ? 'bg-swedish-blue' : 'bg-gray-200'
                  )}
                >
                  <div
                    className={clsx(
                      'absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all',
                      showAvailableOnly ? 'left-5' : 'left-0.5'
                    )}
                  />
                </div>
                <span className="text-sm text-gray-600">Tillgängliga platser</span>
              </label>
            </div>
          </div>

          {/* Results */}
          {loading ? (
            <div className="text-center py-20">
              <div className="w-8 h-8 border-2 border-swedish-blue border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-gray-400 text-sm">Laddar kurser...</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-500 mb-6">
                {sessions.length === 0 ? 'Inga kurser hittades' : `${sessions.length} pass hittades`}
              </p>

              {sessions.length === 0 ? (
                <div className="text-center py-20">
                  <div className="text-5xl mb-4">📅</div>
                  <h3 className="text-xl font-bold text-gray-700 mb-2">Inga kurser hittades</h3>
                  <p className="text-gray-400">Prova att ändra dina filterinställningar.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {sessions.map((session) => (
                    <SessionCard key={session.id} session={session} isLoggedIn={!!user} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
