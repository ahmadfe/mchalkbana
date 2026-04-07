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
  Eye,
  Globe,
  Lock,
  Save,
  FileText,
  School,
  EyeOff,
} from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '@/context/AuthContext';

type Tab = 'overview' | 'courses' | 'sessions' | 'bookings' | 'schools';

interface AdminStats {
  totalBookings: number;
  revenue: number;
  upcomingSessions: number;
  totalStudents: number;
}

interface StudentRecord {
  bookingId: number;
  status: string;
  bookingTime: string;
  name: string;
  personnummer: string;
  phone: string;
  email: string;
  bookedBySchool: string | null;
}

interface SessionStudentsData {
  session: {
    id: number;
    startTime: string;
    endTime: string;
    seatLimit: number;
    seatsAvailable: number;
    course: Course;
    school: { name: string };
  };
  students: StudentRecord[];
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

  // Custom receipt message
  const [receiptMessage, setReceiptMessage] = useState('');
  const [messageSaving, setMessageSaving] = useState(false);

  // Session students modal
  const [studentsData, setStudentsData] = useState<SessionStudentsData | null>(null);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [addStudentForm, setAddStudentForm] = useState({ name: '', personnummer: '', phone: '', email: '' });
  const [addStudentError, setAddStudentError] = useState('');
  const [addStudentSaving, setAddStudentSaving] = useState(false);
  const [showAddStudent, setShowAddStudent] = useState(false);

  const [schools, setSchools] = useState<{ id: number; name: string }[]>([]);
  const [schoolAccounts, setSchoolAccounts] = useState<{ id: number; name: string; email: string; createdAt: string }[]>([]);
  const [newSchoolAccount, setNewSchoolAccount] = useState({ name: '', email: '', password: '' });
  const [schoolAccountError, setSchoolAccountError] = useState('');
  const [schoolAccountSaving, setSchoolAccountSaving] = useState(false);
  const [showSchoolPwd, setShowSchoolPwd] = useState(false);
  const [newCourse, setNewCourse] = useState({ titleSv: '', titleEn: '', description: '', type: 'Risk1', vehicle: 'Car', behorighet: 'B', price: '' });
  const [newSession, setNewSession] = useState({ courseId: '', schoolId: '', startTime: '', endTime: '', seatLimit: '20', visibility: 'public' });

  const loadData = useCallback(async () => {
    setLoading(true);
    const [statsRes, coursesRes, sessionsRes, bookingsRes, msgRes, schoolsRes, schoolAccountsRes] = await Promise.all([
      fetch('/api/admin/stats'),
      fetch('/api/admin/courses'),
      fetch('/api/admin/sessions'),
      fetch('/api/admin/bookings'),
      fetch('/api/admin/settings?key=receipt_message'),
      fetch('/api/admin/schools'),
      fetch('/api/admin/school-accounts'),
    ]);
    const [statsData, coursesData, sessionsData, bookingsData, msgData, schoolsData, schoolAccountsData] = await Promise.all([
      statsRes.json(),
      coursesRes.json(),
      sessionsRes.json(),
      bookingsRes.json(),
      msgRes.json(),
      schoolsRes.json(),
      schoolAccountsRes.json(),
    ]);
    setStats(statsData);
    setCourses(coursesData.courses || []);
    setSessions(sessionsData.sessions || []);
    setBookings(bookingsData.bookings || []);
    setReceiptMessage(msgData.value || '');
    const loadedSchools = schoolsData.schools || [];
    setSchools(loadedSchools);
    if (loadedSchools.length > 0) {
      setNewSession((prev) => ({ ...prev, schoolId: String(loadedSchools[0].id) }));
    }
    setSchoolAccounts(schoolAccountsData.accounts || []);
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
    { id: 'schools', label: 'Trafikskolor', icon: <School className="w-4 h-4" /> },
  ];

  const handleDeleteCourse = async (id: number) => {
    await fetch(`/api/admin/courses/${id}`, { method: 'DELETE' });
    setCourses((prev) => prev.filter((c) => c.id !== id));
  };

  const handleDeleteSession = async (id: number) => {
    await fetch(`/api/admin/sessions/${id}`, { method: 'DELETE' });
    setSessions((prev) => prev.filter((s) => s.id !== id));
  };

  const handleToggleVisibility = async (session: Session) => {
    const newVisibility = session.visibility === 'public' ? 'school' : 'public';
    const res = await fetch(`/api/admin/sessions/${session.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visibility: newVisibility }),
    });
    if (res.ok) {
      setSessions((prev) => prev.map((s) => s.id === session.id ? { ...s, visibility: newVisibility } : s));
    }
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
      setNewCourse({ titleSv: '', titleEn: '', description: '', type: 'Risk1', vehicle: 'Car', behorighet: 'B', price: '' });
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
      setNewSession({ courseId: '', schoolId: schools.length > 0 ? String(schools[0].id) : '', startTime: '', endTime: '', seatLimit: '20', visibility: 'public' });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  const handleSaveReceiptMessage = async () => {
    setMessageSaving(true);
    await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'receipt_message', value: receiptMessage }),
    });
    setMessageSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleCreateSchoolAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setSchoolAccountError('');
    setSchoolAccountSaving(true);
    const res = await fetch('/api/admin/school-accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newSchoolAccount),
    });
    const data = await res.json();
    setSchoolAccountSaving(false);
    if (!res.ok) {
      setSchoolAccountError(data.error || 'Något gick fel');
      return;
    }
    setSchoolAccounts((prev) => [data.account, ...prev]);
    setNewSchoolAccount({ name: '', email: '', password: '' });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleDeleteSchoolAccount = async (id: number) => {
    await fetch('/api/admin/school-accounts', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    setSchoolAccounts((prev) => prev.filter((a) => a.id !== id));
  };

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentsData) return;
    setAddStudentError('');
    setAddStudentSaving(true);
    const res = await fetch(`/api/admin/bookings/${studentsData.session.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(addStudentForm),
    });
    const data = await res.json();
    setAddStudentSaving(false);
    if (!res.ok) { setAddStudentError(data.error || 'Något gick fel'); return; }
    // Reload students
    const updated = await fetch(`/api/admin/sessions/${studentsData.session.id}/students`);
    const updatedData = await updated.json();
    setStudentsData(updatedData);
    setAddStudentForm({ name: '', personnummer: '', phone: '', email: '' });
    setShowAddStudent(false);
  };

  const handleDeleteStudent = async (bookingId: number) => {
    if (!studentsData) return;
    await fetch(`/api/admin/bookings/${bookingId}`, { method: 'DELETE' });
    const updated = await fetch(`/api/admin/sessions/${studentsData.session.id}/students`);
    const updatedData = await updated.json();
    setStudentsData(updatedData);
  };

  const handleViewStudents = async (sessionId: number) => {
    setStudentsLoading(true);
    setStudentsData(null);
    const res = await fetch(`/api/admin/sessions/${sessionId}/students`);
    const data = await res.json();
    setStudentsData(data);
    setStudentsLoading(false);
  };

  const exportXml = (data: SessionStudentsData) => {
    const course = data.session.course;
    const utbDatum = new Date(data.session.startTime).toISOString().split('T')[0];

    const elevRows = data.students
      .filter((s) => s.personnummer && s.personnummer !== '–')
      .map((s) => `    <Elev>\n        <PersonNr>${s.personnummer}</PersonNr>\n        <UtbDatum>${utbDatum}</UtbDatum>\n    </Elev>`)
      .join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>\n<Rapport>\n    <Behorighet>${course.behorighet || 'B'}</Behorighet>\n${elevRows}\n</Rapport>`;

    const blob = new Blob([xml], { type: 'application/xml;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `elever_session_${data.session.id}_${utbDatum}.xml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportCsv = () => {
    const rows = [
      ['ID', 'Elev', 'Personnummer', 'E-post', 'Kurs', 'Datum', 'Status', 'Belopp'],
      ...bookings.map((b) => [
        b.id,
        b.guestName || b.user?.name || '–',
        b.personnummer || '–',
        b.guestEmail || b.user?.email || '–',
        locale === 'sv' ? b.session?.course?.titleSv : b.session?.course?.titleEn,
        b.session ? new Date(b.session.startTime).toLocaleDateString('sv-SE') : '–',
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

  const getStudentName = (b: Booking) => b.guestName || (b.user as { name?: string } | null | undefined)?.name || '–';

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

              {/* Custom receipt message */}
              <div className="bg-white rounded-xl border border-gray-100 p-5 mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="w-4 h-4 text-swedish-blue" />
                  <h2 className="font-bold text-gray-900">Meddelande på kvitto</h2>
                </div>
                <p className="text-sm text-gray-500 mb-3">Detta meddelande visas på bokningskvittot som skickas till eleven.</p>
                <textarea
                  value={receiptMessage}
                  onChange={(e) => setReceiptMessage(e.target.value)}
                  rows={3}
                  className="input-field resize-none"
                  placeholder="T.ex. &quot;Ta med körkort och ID-handling. Parkering finns på framsidan.&quot;"
                />
                <div className="flex justify-end mt-3">
                  <button
                    onClick={handleSaveReceiptMessage}
                    disabled={messageSaving}
                    className="btn-primary flex items-center gap-2 text-sm py-2 px-4 disabled:opacity-60"
                  >
                    <Save className="w-4 h-4" />
                    {messageSaving ? 'Sparar...' : 'Spara meddelande'}
                  </button>
                </div>
              </div>

              {/* Recent bookings table */}
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <div className="flex items-center justify-between p-5 border-b border-gray-100">
                  <h2 className="font-bold text-gray-900">Senaste bokningar</h2>
                  <button onClick={exportCsv} className="flex items-center gap-2 text-sm text-swedish-blue hover:underline">
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
                        <th className="text-left py-3 px-5">Personnummer</th>
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
                          <td className="py-3 px-5 font-medium">{getStudentName(b)}</td>
                          <td className="py-3 px-5 text-gray-500 font-mono text-xs">{b.personnummer || '–'}</td>
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
                      <th className="text-left py-3 px-5">Behörighet</th>
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
                        <td className="py-3 px-5 font-mono font-semibold text-swedish-blue">{c.behorighet}</td>
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
                  <div key={s.id} className="bg-white rounded-xl border border-gray-100 p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={clsx(
                          'w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm shrink-0',
                          s.course?.type === 'Risk1' ? 'bg-blue-100 text-swedish-blue' : 'bg-orange-100 text-orange-700'
                        )}>
                          {s.course?.type === 'Risk1' ? 'R1' : 'R2'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-gray-900">{locale === 'sv' ? s.course?.titleSv : s.course?.titleEn}</p>
                            <span className={clsx(
                              'px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1',
                              s.visibility === 'public' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                            )}>
                              {s.visibility === 'public' ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                              {s.visibility === 'public' ? 'Offentlig' : 'Skolkonto'}
                            </span>
                          </div>
                          <div className="flex gap-4 text-xs text-gray-500 mt-1">
                            <span>📅 {new Date(s.startTime).toLocaleDateString('sv-SE')}</span>
                            <span>🕐 {new Date(s.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – {new Date(s.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            <span>📍 {s.school?.name}</span>
                            <span>👤 {s.seatsAvailable}/{s.seatLimit} platser kvar</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 flex-wrap justify-end">
                        <button
                          onClick={() => handleViewStudents(s.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-swedish-blue border border-swedish-blue rounded-lg hover:bg-blue-50 transition"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Visa elever
                        </button>
                        <button
                          onClick={() => handleToggleVisibility(s)}
                          className={clsx(
                            'flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition',
                            s.visibility === 'public'
                              ? 'text-orange-600 border-orange-300 hover:bg-orange-50'
                              : 'text-green-600 border-green-300 hover:bg-green-50'
                          )}
                        >
                          {s.visibility === 'public' ? <><Lock className="w-3.5 h-3.5" /> Gör skolkonto</> : <><Globe className="w-3.5 h-3.5" /> Gör offentlig</>}
                        </button>
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
                <button onClick={exportCsv} className="flex items-center gap-2 btn-outline text-sm py-2">
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
                      <th className="text-left py-3 px-5">Personnummer</th>
                      <th className="text-left py-3 px-5">E-post</th>
                      <th className="text-left py-3 px-5">Kurs</th>
                      <th className="text-left py-3 px-5">Datum</th>
                      <th className="text-left py-3 px-5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {bookings.map((b) => (
                      <tr key={b.id} className="hover:bg-gray-50">
                        <td className="py-3 px-5 text-gray-500">#{b.id}</td>
                        <td className="py-3 px-5 font-medium">{getStudentName(b)}</td>
                        <td className="py-3 px-5 text-gray-500 font-mono text-xs">{b.personnummer || '–'}</td>
                        <td className="py-3 px-5 text-gray-500 text-xs">{b.guestEmail || (b.user as { email?: string } | null | undefined)?.email || '–'}</td>
                        <td className="py-3 px-5">{locale === 'sv' ? b.session?.course?.titleSv : b.session?.course?.titleEn}</td>
                        <td className="py-3 px-5 text-gray-500">{b.session ? new Date(b.session.startTime).toLocaleDateString('sv-SE') : '–'}</td>
                        <td className="py-3 px-5">
                          <span className={clsx(
                            'px-2.5 py-1 rounded-full text-xs font-semibold',
                            b.status === 'Paid' ? 'bg-green-100 text-green-700' :
                            b.status === 'Canceled' ? 'bg-red-100 text-red-700' :
                            b.status === 'Confirmed' ? 'bg-blue-100 text-blue-700' :
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

          {/* School Accounts */}
          {tab === 'schools' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Create form */}
              <div className="bg-white rounded-xl border border-gray-100 p-6">
                <div className="flex items-center gap-2 mb-5">
                  <School className="w-5 h-5 text-swedish-blue" />
                  <h2 className="font-bold text-gray-900">Skapa trafikskola-konto</h2>
                </div>
                {schoolAccountError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-4">
                    {schoolAccountError}
                  </div>
                )}
                <form className="space-y-4" onSubmit={handleCreateSchoolAccount}>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Trafikskolans namn</label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="Uppsala Trafikskola AB"
                      value={newSchoolAccount.name}
                      onChange={(e) => setNewSchoolAccount({ ...newSchoolAccount, name: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">E-postadress</label>
                    <input
                      type="email"
                      className="input-field"
                      placeholder="skola@example.se"
                      value={newSchoolAccount.email}
                      onChange={(e) => setNewSchoolAccount({ ...newSchoolAccount, email: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Lösenord</label>
                    <div className="relative">
                      <input
                        type={showSchoolPwd ? 'text' : 'password'}
                        className="input-field pr-10"
                        placeholder="Minst 8 tecken"
                        value={newSchoolAccount.password}
                        onChange={(e) => setNewSchoolAccount({ ...newSchoolAccount, password: e.target.value })}
                        required
                        minLength={8}
                      />
                      <button
                        type="button"
                        onClick={() => setShowSchoolPwd(!showSchoolPwd)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showSchoolPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={schoolAccountSaving}
                    className="w-full btn-primary py-2.5 flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {schoolAccountSaving ? (
                      <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Skapar...</>
                    ) : (
                      <><Plus className="w-4 h-4" />Skapa konto</>
                    )}
                  </button>
                </form>
              </div>

              {/* Existing accounts */}
              <div className="bg-white rounded-xl border border-gray-100 p-6">
                <h2 className="font-bold text-gray-900 mb-5">Befintliga trafikskolor ({schoolAccounts.length})</h2>
                {schoolAccounts.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <School className="w-10 h-10 mx-auto mb-3 text-gray-200" />
                    <p className="text-sm">Inga trafikskola-konton ännu.</p>
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {schoolAccounts.map((acc) => (
                      <li key={acc.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition">
                        <div>
                          <p className="font-medium text-gray-900 text-sm">{acc.name}</p>
                          <p className="text-xs text-gray-500">{acc.email}</p>
                        </div>
                        <button
                          onClick={() => handleDeleteSchoolAccount(acc.id)}
                          className="text-gray-400 hover:text-red-500 transition p-1"
                          title="Ta bort konto"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Session Students Modal */}
      {(studentsData || studentsLoading) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-4xl w-full shadow-2xl max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-lg">
                  {studentsData ? `${locale === 'sv' ? studentsData.session.course.titleSv : studentsData.session.course.titleEn}` : 'Laddar...'}
                </h3>
                {studentsData && (
                  <p className="text-sm text-gray-500 mt-0.5">
                    {new Date(studentsData.session.startTime).toLocaleDateString('sv-SE')} · {studentsData.session.school.name} · {studentsData.students.length}/{studentsData.session.seatLimit} platser
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {studentsData && studentsData.students.length > 0 && (
                  <button onClick={() => exportXml(studentsData)} className="flex items-center gap-1.5 px-3 py-2 text-sm bg-swedish-blue text-white rounded-lg hover:bg-blue-700 transition">
                    <Download className="w-4 h-4" />Exportera XML
                  </button>
                )}
                {studentsData && (
                  <button
                    onClick={() => { setShowAddStudent(!showAddStudent); setAddStudentError(''); }}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                  >
                    <Plus className="w-4 h-4" />Lägg till elev
                  </button>
                )}
                <button onClick={() => { setStudentsData(null); setStudentsLoading(false); setShowAddStudent(false); }} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Add student form */}
            {showAddStudent && studentsData && (
              <form onSubmit={handleAddStudent} className="bg-gray-50 rounded-xl p-4 mb-4 grid grid-cols-2 gap-3">
                {addStudentError && (
                  <div className="col-span-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{addStudentError}</div>
                )}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Namn *</label>
                  <input type="text" className="input-field text-sm" placeholder="Anna Svensson" value={addStudentForm.name} onChange={(e) => setAddStudentForm({ ...addStudentForm, name: e.target.value })} required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Personnummer *</label>
                  <input type="text" className="input-field text-sm" placeholder="YYYYMMDD-XXXX" value={addStudentForm.personnummer} onChange={(e) => setAddStudentForm({ ...addStudentForm, personnummer: e.target.value })} required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Telefon</label>
                  <input type="text" className="input-field text-sm" placeholder="070-000 00 00" value={addStudentForm.phone} onChange={(e) => setAddStudentForm({ ...addStudentForm, phone: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">E-post</label>
                  <input type="email" className="input-field text-sm" placeholder="elev@example.se" value={addStudentForm.email} onChange={(e) => setAddStudentForm({ ...addStudentForm, email: e.target.value })} />
                </div>
                <div className="col-span-2 flex gap-2 justify-end">
                  <button type="button" onClick={() => setShowAddStudent(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-100">Avbryt</button>
                  <button type="submit" disabled={addStudentSaving} className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-60 flex items-center gap-2">
                    {addStudentSaving ? <><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />Sparar...</> : 'Lägg till'}
                  </button>
                </div>
              </form>
            )}

            {studentsLoading && (
              <div className="flex-1 flex items-center justify-center py-12">
                <div className="w-8 h-8 border-2 border-swedish-blue border-t-transparent rounded-full animate-spin" />
              </div>
            )}

            {studentsData && (
              <div className="overflow-auto flex-1">
                {studentsData.students.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Users className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                    <p>Inga bokningar för detta pass ännu.</p>
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide sticky top-0">
                      <tr>
                        <th className="text-left py-3 px-4">#</th>
                        <th className="text-left py-3 px-4">Namn</th>
                        <th className="text-left py-3 px-4">Personnummer</th>
                        <th className="text-left py-3 px-4">Telefon</th>
                        <th className="text-left py-3 px-4">E-post</th>
                        <th className="text-left py-3 px-4">Bokad av</th>
                        <th className="text-left py-3 px-4">Status</th>
                        <th className="text-left py-3 px-4"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {studentsData.students.map((s, i) => (
                        <tr key={s.bookingId} className="hover:bg-gray-50">
                          <td className="py-2.5 px-4 text-gray-400">{i + 1}</td>
                          <td className="py-2.5 px-4 font-medium">{s.name}</td>
                          <td className="py-2.5 px-4 font-mono text-xs text-gray-700">{s.personnummer}</td>
                          <td className="py-2.5 px-4 text-gray-500 text-xs">{s.phone}</td>
                          <td className="py-2.5 px-4 text-gray-500 text-xs">{s.email}</td>
                          <td className="py-2.5 px-4 text-xs">
                            {s.bookedBySchool ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-semibold">
                                <School className="w-3 h-3" />{s.bookedBySchool}
                              </span>
                            ) : (
                              <span className="text-gray-400">Elev</span>
                            )}
                          </td>
                          <td className="py-2.5 px-4">
                            <span className={clsx('px-2 py-0.5 rounded-full text-xs font-semibold',
                              s.status === 'Paid' ? 'bg-green-100 text-green-700' :
                              s.status === 'Confirmed' ? 'bg-blue-100 text-blue-700' :
                              'bg-yellow-100 text-yellow-700'
                            )}>{s.status}</span>
                          </td>
                          <td className="py-2.5 px-4">
                            <button onClick={() => handleDeleteStudent(s.bookingId)} className="text-gray-300 hover:text-red-500 transition" title="Ta bort">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                <p className="text-xs text-gray-400 mt-4 text-right">
                  Totalt: {studentsData.students.length} elev{studentsData.students.length !== 1 ? 'er' : ''} · {studentsData.session.seatsAvailable} platser kvar
                </p>
              </div>
            )}
          </div>
        </div>
      )}

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
              <div className="grid grid-cols-3 gap-3">
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
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Behörighet</label>
                  <select className="input-field" value={newCourse.behorighet} onChange={(e) => setNewCourse({ ...newCourse, behorighet: e.target.value })}>
                    <option value="B">B</option>
                    <option value="A">A</option>
                    <option value="AM">AM</option>
                    <option value="A1">A1</option>
                    <option value="A2">A2</option>
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Halkbana</label>
                <select className="input-field" value={newSession.schoolId} onChange={(e) => setNewSession({ ...newSession, schoolId: e.target.value })} required>
                  <option value="">Välj halkbana...</option>
                  {schools.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Platsgräns</label>
                  <input type="number" className="input-field" placeholder="20" min="1" value={newSession.seatLimit} onChange={(e) => setNewSession({ ...newSession, seatLimit: e.target.value })} required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Synlighet</label>
                  <select className="input-field" value={newSession.visibility} onChange={(e) => setNewSession({ ...newSession, visibility: e.target.value })}>
                    <option value="public">Offentlig</option>
                    <option value="school">Skolkonto</option>
                  </select>
                </div>
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
