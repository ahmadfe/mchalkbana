'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import type { Course, Session, Booking } from '@/lib/types';
import {
  LayoutDashboard,
  BookOpen,
  Calendar,
  Users,
  TrendingUp,
  Download,
  Plus,
  Pencil,
  Trash2,
  X,
  CheckCircle2,
} from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '@/context/AuthContext';

type Tab = 'overview' | 'courses' | 'sessions' | 'bookings';

interface AdminStats {
  totalBookings: number;
  revenue: number;
  upcomingSessions: number;
  totalStudents: number;
}

export default function AdminPage() {
  const t = useTranslations('admin');
  const locale = useLocale();
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();

  const [tab, setTab] = useState<Tab>('overview');
  const [showAddCourse, setShowAddCourse] = useState(false);
  const [showAddSession, setShowAddSession] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  // New course form state
  const [newCourse, setNewCourse] = useState({ titleSv: '', titleEn: '', description: '', type: 'Risk1', vehicle: 'Car', price: '' });
  // New session form state
  const [newSession, setNewSession] = useState({ courseId: '', schoolId: '1', startTime: '', endTime: '', seatLimit: '20' });

  const loadData = useCallback(async () => {
    setLoading(true);
    const [statsRes, coursesRes, sessionsRes, bookingsRes] = await Promise.all([
      fetch('/api/admin/stats'),
      fetch('/api/admin/courses'),
      fetch('/api/admin/sessions'),
      fetch('/api/admin/bookings'),
    ]);
    const [statsData, coursesData, sessionsData, bookingsData] = await Promise.all([
      statsRes.json(),
      coursesRes.json(),
      sessionsRes.json(),
      bookingsRes.json(),
    ]);
    setStats(statsData);
    setCourses(coursesData.courses || []);
    setSessions(sessionsData.sessions || []);
    setBookings(bookingsData.bookings || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!authLoading && !user) { router.push(`/${locale}/login`); return; }
    if (!authLoading && user?.role !== 'admin') { router.push(`/${locale}/dashboard`); return; }
    if (user?.role === 'admin') loadData();
  }, [user, authLoading, locale, router, loadData]);

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: t('overview'), icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'courses', label: t('manage_courses'), icon: <BookOpen className="w-4 h-4" /> },
    { id: 'sessions', label: t('manage_sessions'), icon: <Calendar className="w-4 h-4" /> },
    { id: 'bookings', label: t('bookings'), icon: <Users className="w-4 h-4" /> },
  ];

  const handleDeleteCourse = async (id: number) => {
    await fetch(`/api/admin/courses/${id}`, { method: 'DELETE' });
    setCourses((prev) => prev.filter((c) => c.id !== id));
  };

  const handleDeleteSession = async (id: number) => {
    await fetch(`/api/admin/sessions/${id}`, { method: 'DELETE' });
    setSessions((prev) => prev.filter((s) => s.id !== id));
  };

  const handleAddCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/admin/courses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newCourse),
    });
    if (res.ok) {
      const data = await res.json();
      setCourses((prev) => [...prev, data.course]);
      setShowAddCourse(false);
      setNewCourse({ titleSv: '', titleEn: '', description: '', type: 'Risk1', vehicle: 'Car', price: '' });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  const handleAddSession = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/admin/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newSession),
    });
    if (res.ok) {
      const data = await res.json();
      setSessions((prev) => [...prev, data.session]);
      setShowAddSession(false);
      setNewSession({ courseId: '', schoolId: '1', startTime: '', endTime: '', seatLimit: '20' });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  const exportCSV = () => {
    const rows = [
      ['ID', 'Student', 'Kurs', 'Datum', 'Status', 'Belopp'],
      ...bookings.map((b) => [
        b.id,
        (b as Booking & { user?: { name: string } }).user?.name || '–',
        locale === 'sv' ? b.session?.course?.titleSv : b.session?.course?.titleEn,
        new Date(b.session!.startTime).toLocaleDateString('sv-SE'),
        b.status,
        b.session?.course?.price || 0,
      ]),
    ];
    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bokningar.csv';
    a.click();
    URL.revokeObjectURL(url);
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
            {saved && (
              <div className="flex items-center gap-2 bg-green-100 text-green-700 px-4 py-2 rounded-xl text-sm font-medium">
                <CheckCircle2 className="w-4 h-4" />
                Sparat!
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1 mb-8 overflow-x-auto">
            {tabs.map((tabItem) => (
              <button
                key={tabItem.id}
                onClick={() => setTab(tabItem.id)}
                className={clsx(
                  'flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition whitespace-nowrap',
                  tab === tabItem.id
                    ? 'bg-swedish-blue text-white'
                    : 'text-gray-600 hover:bg-gray-50'
                )}
              >
                {tabItem.icon}
                {tabItem.label}
              </button>
            ))}
          </div>

          {/* Overview */}
          {tab === 'overview' && stats && (
            <div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
                {[
                  { label: t('total_bookings'), value: stats.totalBookings, icon: <BookOpen />, color: 'text-swedish-blue bg-blue-50' },
                  { label: t('revenue'), value: `${(stats.revenue / 1000).toFixed(0)}k kr`, icon: <TrendingUp />, color: 'text-green-600 bg-green-50' },
                  { label: t('upcoming_sessions'), value: stats.upcomingSessions, icon: <Calendar />, color: 'text-orange-600 bg-orange-50' },
                  { label: t('students'), value: stats.totalStudents, icon: <Users />, color: 'text-purple-600 bg-purple-50' },
                ].map((stat) => (
                  <div key={stat.label} className="bg-white rounded-xl border border-gray-100 p-5">
                    <div className={clsx('w-10 h-10 rounded-lg flex items-center justify-center mb-3', stat.color)}>
                      {stat.icon}
                    </div>
                    <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
                    <div className="text-sm text-gray-500 mt-1">{stat.label}</div>
                  </div>
                ))}
              </div>

              {/* Recent bookings table */}
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <div className="flex items-center justify-between p-5 border-b border-gray-100">
                  <h2 className="font-bold text-gray-900">Senaste bokningar</h2>
                  <button onClick={exportCSV} className="flex items-center gap-2 text-sm text-swedish-blue hover:underline">
                    <Download className="w-4 h-4" />
                    {t('export_csv')}
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                      <tr>
                        <th className="text-left py-3 px-5">ID</th>
                        <th className="text-left py-3 px-5">Elev</th>
                        <th className="text-left py-3 px-5">Kurs</th>
                        <th className="text-left py-3 px-5">Datum</th>
                        <th className="text-left py-3 px-5">Status</th>
                        <th className="text-left py-3 px-5">Belopp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {bookings.slice(0, 10).map((b) => (
                        <tr key={b.id} className="hover:bg-gray-50">
                          <td className="py-3 px-5 text-gray-500">#{b.id}</td>
                          <td className="py-3 px-5 font-medium">{(b as Booking & { user?: { name: string } }).user?.name || '–'}</td>
                          <td className="py-3 px-5">
                            {locale === 'sv' ? b.session?.course?.titleSv : b.session?.course?.titleEn}
                          </td>
                          <td className="py-3 px-5 text-gray-500">
                            {b.session ? new Date(b.session.startTime).toLocaleDateString('sv-SE') : '–'}
                          </td>
                          <td className="py-3 px-5">
                            <span className={clsx(
                              'px-2.5 py-1 rounded-full text-xs font-semibold',
                              b.status === 'Paid' ? 'bg-green-100 text-green-700' :
                              b.status === 'Canceled' ? 'bg-red-100 text-red-700' :
                              'bg-yellow-100 text-yellow-700'
                            )}>
                              {b.status}
                            </span>
                          </td>
                          <td className="py-3 px-5 font-semibold">
                            {b.session?.course?.price?.toLocaleString('sv-SE')} kr
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Courses */}
          {tab === 'courses' && (
            <div>
              <div className="flex justify-between items-center mb-5">
                <h2 className="font-bold text-gray-900">Kurser ({courses.length})</h2>
                <button
                  onClick={() => setShowAddCourse(true)}
                  className="btn-primary flex items-center gap-2 text-sm py-2"
                >
                  <Plus className="w-4 h-4" />
                  {t('add_course')}
                </button>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                    <tr>
                      <th className="text-left py-3 px-5">Kurs</th>
                      <th className="text-left py-3 px-5">Typ</th>
                      <th className="text-left py-3 px-5">Fordon</th>
                      <th className="text-left py-3 px-5">Pris</th>
                      <th className="text-left py-3 px-5">Åtgärder</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {courses.map((c) => (
                      <tr key={c.id} className="hover:bg-gray-50">
                        <td className="py-3 px-5 font-medium">{locale === 'sv' ? c.titleSv : c.titleEn}</td>
                        <td className="py-3 px-5">
                          <span className={clsx(
                            'px-2.5 py-1 rounded-full text-xs font-semibold',
                            c.type === 'Risk1' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-700'
                          )}>
                            {c.type}
                          </span>
                        </td>
                        <td className="py-3 px-5 text-gray-500">{c.vehicle === 'Car' ? '🚗 Bil' : '🏍️ Motorcykel'}</td>
                        <td className="py-3 px-5 font-semibold">{c.price.toLocaleString('sv-SE')} kr</td>
                        <td className="py-3 px-5">
                          <div className="flex gap-2">
                            <button className="p-1.5 text-gray-400 hover:text-swedish-blue rounded-lg hover:bg-blue-50">
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteCourse(c.id)}
                              className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Sessions */}
          {tab === 'sessions' && (
            <div>
              <div className="flex justify-between items-center mb-5">
                <h2 className="font-bold text-gray-900">Pass ({sessions.length})</h2>
                <button
                  onClick={() => setShowAddSession(true)}
                  className="btn-primary flex items-center gap-2 text-sm py-2"
                >
                  <Plus className="w-4 h-4" />
                  {t('add_session')}
                </button>
              </div>
              <div className="space-y-3">
                {sessions.map((s) => (
                  <div key={s.id} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={clsx(
                        'w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm shrink-0',
                        s.course?.type === 'Risk1' ? 'bg-blue-100 text-swedish-blue' : 'bg-orange-100 text-orange-700'
                      )}>
                        {s.course?.type === 'Risk1' ? 'R1' : 'R2'}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{locale === 'sv' ? s.course?.titleSv : s.course?.titleEn}</p>
                        <div className="flex gap-4 text-xs text-gray-500 mt-1">
                          <span>📅 {new Date(s.startTime).toLocaleDateString('sv-SE')}</span>
                          <span>🕐 {new Date(s.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          <span>📍 {s.school?.name}</span>
                          <span>👤 {s.seatsAvailable}/{s.seatLimit}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button className="p-1.5 text-gray-400 hover:text-swedish-blue rounded-lg hover:bg-blue-50">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteSession(s.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bookings */}
          {tab === 'bookings' && (
            <div>
              <div className="flex justify-between items-center mb-5">
                <h2 className="font-bold text-gray-900">Alla bokningar ({bookings.length})</h2>
                <button onClick={exportCSV} className="flex items-center gap-2 btn-outline text-sm py-2">
                  <Download className="w-4 h-4" />
                  {t('export_csv')}
                </button>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                    <tr>
                      <th className="text-left py-3 px-5">Bokning</th>
                      <th className="text-left py-3 px-5">Elev</th>
                      <th className="text-left py-3 px-5">Kurs</th>
                      <th className="text-left py-3 px-5">Datum</th>
                      <th className="text-left py-3 px-5">Bokad</th>
                      <th className="text-left py-3 px-5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {bookings.map((b) => (
                      <tr key={b.id} className="hover:bg-gray-50">
                        <td className="py-3 px-5 text-gray-500">#{b.id}</td>
                        <td className="py-3 px-5 font-medium">{(b as Booking & { user?: { name: string } }).user?.name || '–'}</td>
                        <td className="py-3 px-5">{locale === 'sv' ? b.session?.course?.titleSv : b.session?.course?.titleEn}</td>
                        <td className="py-3 px-5 text-gray-500">{b.session ? new Date(b.session.startTime).toLocaleDateString('sv-SE') : '–'}</td>
                        <td className="py-3 px-5 text-gray-500">{new Date(b.bookingTime).toLocaleDateString('sv-SE')}</td>
                        <td className="py-3 px-5">
                          <span className={clsx(
                            'px-2.5 py-1 rounded-full text-xs font-semibold',
                            b.status === 'Paid' ? 'bg-green-100 text-green-700' :
                            b.status === 'Canceled' ? 'bg-red-100 text-red-700' :
                            'bg-yellow-100 text-yellow-700'
                          )}>
                            {b.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Add Course Modal */}
      {showAddCourse && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-lg">{t('add_course')}</h3>
              <button onClick={() => setShowAddCourse(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form className="space-y-4" onSubmit={handleAddCourse}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Titel (Svenska)</label>
                <input type="text" className="input-field" placeholder="Risk 1 – Bil" value={newCourse.titleSv} onChange={(e) => setNewCourse({ ...newCourse, titleSv: e.target.value })} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Title (English)</label>
                <input type="text" className="input-field" placeholder="Risk 1 – Car" value={newCourse.titleEn} onChange={(e) => setNewCourse({ ...newCourse, titleEn: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Beskrivning</label>
                <input type="text" className="input-field" value={newCourse.description} onChange={(e) => setNewCourse({ ...newCourse, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Typ</label>
                  <select className="input-field" value={newCourse.type} onChange={(e) => setNewCourse({ ...newCourse, type: e.target.value })}>
                    <option value="Risk1">Risk 1</option>
                    <option value="Risk2">Risk 2</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Fordon</label>
                  <select className="input-field" value={newCourse.vehicle} onChange={(e) => setNewCourse({ ...newCourse, vehicle: e.target.value })}>
                    <option value="Car">Bil</option>
                    <option value="Motorcycle">Motorcykel</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Pris (kr)</label>
                <input type="number" className="input-field" placeholder="1500" value={newCourse.price} onChange={(e) => setNewCourse({ ...newCourse, price: e.target.value })} required />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAddCourse(false)} className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl hover:bg-gray-50">
                  Avbryt
                </button>
                <button type="submit" className="flex-1 btn-primary py-2.5">
                  Spara kurs
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Session Modal */}
      {showAddSession && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-lg">{t('add_session')}</h3>
              <button onClick={() => setShowAddSession(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form className="space-y-4" onSubmit={handleAddSession}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Kurs</label>
                <select className="input-field" value={newSession.courseId} onChange={(e) => setNewSession({ ...newSession, courseId: e.target.value })} required>
                  <option value="">Välj kurs...</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>{locale === 'sv' ? c.titleSv : c.titleEn}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Startdatum</label>
                  <input type="datetime-local" className="input-field" value={newSession.startTime} onChange={(e) => setNewSession({ ...newSession, startTime: e.target.value })} required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Slutdatum</label>
                  <input type="datetime-local" className="input-field" value={newSession.endTime} onChange={(e) => setNewSession({ ...newSession, endTime: e.target.value })} required />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Platsgräns</label>
                <input type="number" className="input-field" placeholder="20" min="1" value={newSession.seatLimit} onChange={(e) => setNewSession({ ...newSession, seatLimit: e.target.value })} required />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAddSession(false)} className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl hover:bg-gray-50">
                  Avbryt
                </button>
                <button type="submit" className="flex-1 btn-primary py-2.5">
                  Spara pass
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
