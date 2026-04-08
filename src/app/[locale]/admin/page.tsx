'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
  Tag,
  CreditCard,
  RotateCcw,
  AlertTriangle,
  ImagePlus,
  Loader2,
  Video,
} from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '@/context/AuthContext';

type Tab = 'overview' | 'courses' | 'sessions' | 'bookings' | 'schools' | 'payments' | 'cards';

interface InfoCardRecord {
  id: number;
  badge: string;
  title: string;
  description: string;
  price: string;
  imageUrl: string;
  videoUrl: string;
  primaryButtonText: string;
  primaryButtonLink: string;
  secondaryButtonText: string;
  secondaryButtonLink: string;
  sortOrder: number;
  visible: boolean;
}

interface PaymentRecord {
  id: number;
  bookingId: number;
  amount: number;
  provider: string;
  status: string;
  transactionId: string | null;
  createdAt: string;
  booking: {
    guestName: string | null;
    guestEmail: string | null;
    personnummer: string | null;
    user: { name: string; email: string } | null;
    session: {
      startTime: string;
      course: { titleSv: string };
      school: { name: string };
    };
  };
}

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

  // Payments
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [refundTarget, setRefundTarget] = useState<PaymentRecord | null>(null);
  const [refunding, setRefunding] = useState(false);

  // Info Cards
  const [infoCards, setInfoCards] = useState<InfoCardRecord[]>([]);
  const [showAddCard, setShowAddCard] = useState(false);
  const [editCard, setEditCard] = useState<InfoCardRecord | null>(null);
  const [cardSaving, setCardSaving] = useState(false);
  const emptyCardForm = { badge: '', title: '', description: '', price: '', imageUrl: '', videoUrl: '', primaryButtonText: 'Läs mer', primaryButtonLink: '/courses', secondaryButtonText: '', secondaryButtonLink: '', sortOrder: 0, visible: true };
  const [cardForm, setCardForm] = useState(emptyCardForm);
  const cardFileRef = useRef<HTMLInputElement>(null);

  const handleCardFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setCardForm((prev) => ({ ...prev, imageUrl: reader.result as string, videoUrl: '' }));
    };
    reader.readAsDataURL(file);
  };

  // Edit booking
  const [editBooking, setEditBooking] = useState<Booking | null>(null);
  const [editForm, setEditForm] = useState({ guestName: '', personnummer: '', guestPhone: '', guestEmail: '', status: '' });
  const [editSaving, setEditSaving] = useState(false);

  // Session assign school
  const [assigningSchoolSession, setAssigningSchoolSession] = useState<number | null>(null);
  const [assignSchoolId, setAssignSchoolId] = useState('');
  const [sessionFilter, setSessionFilter] = useState<'all' | 'public' | 'school'>('all');

  // Course groups
  const [courseGroups, setCourseGroups] = useState<{ id: number; name: string; createdAt: string }[]>([]);
  const [newGroupName, setNewGroupName] = useState('');
  const [groupSaving, setGroupSaving] = useState(false);
  const [groupError, setGroupError] = useState('');

  // Test email
  const [testEmailTo, setTestEmailTo] = useState('');
  const [testEmailStatus, setTestEmailStatus] = useState<'idle' | 'sending' | 'ok' | 'error'>('idle');
  const [testEmailError, setTestEmailError] = useState('');

  const [newCourse, setNewCourse] = useState({ titleSv: '', titleEn: '', description: '', type: 'Risk1', vehicle: 'Car', behorighet: 'B', price: '' });
  const [newSession, setNewSession] = useState({ courseId: '', schoolId: '', startTime: '', endTime: '', seatLimit: '20', visibility: 'public', assignedSchoolUserId: '' });

  const loadData = useCallback(async () => {
    setLoading(true);
    const [statsRes, coursesRes, sessionsRes, bookingsRes, msgRes, schoolsRes, schoolAccountsRes, groupsRes, paymentsRes, cardsRes] = await Promise.all([
      fetch('/api/admin/stats'),
      fetch('/api/admin/courses'),
      fetch('/api/admin/sessions'),
      fetch('/api/admin/bookings'),
      fetch('/api/admin/settings?key=receipt_message'),
      fetch('/api/admin/schools'),
      fetch('/api/admin/school-accounts'),
      fetch('/api/admin/course-groups'),
      fetch('/api/admin/payments'),
      fetch('/api/admin/info-cards'),
    ]);
    const [statsData, coursesData, sessionsData, bookingsData, msgData, schoolsData, schoolAccountsData, groupsData, paymentsData, cardsData] = await Promise.all([
      statsRes.json(),
      coursesRes.json(),
      sessionsRes.json(),
      bookingsRes.json(),
      msgRes.json(),
      schoolsRes.json(),
      schoolAccountsRes.json(),
      groupsRes.json(),
      paymentsRes.json(),
      cardsRes.json(),
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
    setCourseGroups(groupsData.groups || []);
    setPayments(paymentsData.payments || []);
    setInfoCards(cardsData.cards || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!authLoading && !user) { router.push(`/${locale}/login`); return; }
    if (!authLoading && user?.role !== 'admin') { router.push(`/${locale}/dashboard`); return; }
    if (user?.role === 'admin') loadData();
  }, [user, authLoading, locale, router, loadData]);

  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setTestEmailStatus('sending');
    setTestEmailError('');
    const res = await fetch('/api/admin/test-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: testEmailTo }),
    });
    const data = await res.json();
    if (!res.ok) {
      setTestEmailStatus('error');
      setTestEmailError(data.error || 'Något gick fel');
    } else {
      setTestEmailStatus('ok');
    }
  };

  const handleAddGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setGroupError('');
    if (!newGroupName.trim()) { setGroupError('Namn krävs'); return; }
    setGroupSaving(true);
    const res = await fetch('/api/admin/course-groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newGroupName.trim() }),
    });
    const data = await res.json();
    setGroupSaving(false);
    if (!res.ok) { setGroupError(data.error || 'Något gick fel'); return; }
    setCourseGroups((prev) => [...prev, data.group]);
    setNewGroupName('');
  };

  const handleDeleteGroup = async (id: number) => {
    await fetch('/api/admin/course-groups', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    setCourseGroups((prev) => prev.filter((g) => g.id !== id));
  };

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: t('overview'), icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'courses', label: t('manage_courses'), icon: <BookOpen className="w-4 h-4" /> },
    { id: 'sessions', label: t('manage_sessions'), icon: <Calendar className="w-4 h-4" /> },
    { id: 'bookings', label: t('bookings'), icon: <Users className="w-4 h-4" /> },
    { id: 'schools', label: 'Trafikskolor', icon: <School className="w-4 h-4" /> },
    { id: 'payments', label: 'Betalningar', icon: <CreditCard className="w-4 h-4" /> },
    { id: 'cards', label: 'Informationskort', icon: <Tag className="w-4 h-4" /> },
  ];

  const handleSaveCard = async () => {
    setCardSaving(true);
    if (editCard) {
      const res = await fetch(`/api/admin/info-cards/${editCard.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cardForm),
      });
      if (res.ok) {
        const { card } = await res.json();
        setInfoCards((prev) => prev.map((c) => c.id === card.id ? card : c));
        setEditCard(null);
      }
    } else {
      const res = await fetch('/api/admin/info-cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cardForm),
      });
      if (res.ok) {
        const { card } = await res.json();
        setInfoCards((prev) => [...prev, card]);
        setShowAddCard(false);
        setCardForm(emptyCardForm);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    }
    setCardSaving(false);
  };

  const handleDeleteCard = async (id: number) => {
    await fetch(`/api/admin/info-cards/${id}`, { method: 'DELETE' });
    setInfoCards((prev) => prev.filter((c) => c.id !== id));
  };

  const openEditCard = (card: InfoCardRecord) => {
    setEditCard(card);
    setCardForm({ ...card });
    setShowAddCard(false);
  };

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
      setNewSession({ courseId: '', schoolId: schools.length > 0 ? String(schools[0].id) : '', startTime: '', endTime: '', seatLimit: '20', visibility: 'public', assignedSchoolUserId: '' });
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

  const openEditBooking = (b: Booking) => {
    setEditBooking(b);
    setEditForm({
      guestName: b.guestName ?? (b.user as { name?: string } | null | undefined)?.name ?? '',
      personnummer: b.personnummer ?? '',
      guestPhone: b.guestPhone ?? '',
      guestEmail: b.guestEmail ?? (b.user as { email?: string } | null | undefined)?.email ?? '',
      status: b.status,
    });
  };

  const handleEditBookingSave = async () => {
    if (!editBooking) return;
    setEditSaving(true);
    const res = await fetch(`/api/admin/bookings/${editBooking.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    });
    setEditSaving(false);
    if (res.ok) {
      const { booking: updated } = await res.json();
      setBookings((prev) => prev.map((b) => b.id === updated.id ? updated : b));
      setEditBooking(null);
    }
  };

  const handleAssignSchool = async (sessionId: number) => {
    const schoolUserId = assignSchoolId;
    const visibility = schoolUserId ? 'school' : 'public';
    const res = await fetch(`/api/admin/sessions/${sessionId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visibility, assignedSchoolUserId: schoolUserId || null }),
    });
    if (res.ok) {
      const { session: updated } = await res.json();
      setSessions((prev) => prev.map((s) => s.id === sessionId ? { ...s, ...updated } : s));
    }
    setAssigningSchoolSession(null);
    setAssignSchoolId('');
  };

  const handleConfirmRefund = async () => {
    if (!refundTarget) return;
    setRefunding(true);
    const res = await fetch(`/api/admin/payments/${refundTarget.id}/refund`, { method: 'POST' });
    setRefunding(false);
    if (res.ok) {
      setPayments((prev) => prev.map((p) => p.id === refundTarget.id ? { ...p, status: 'Refunded' } : p));
      setRefundTarget(null);
    }
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
                            c.type === 'Risk1' ? 'bg-blue-100 text-blue-800' :
                            c.type === 'Risk2' ? 'bg-orange-100 text-orange-700' :
                            c.type === 'AM' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-700'
                          )}>
                            {c.type}
                          </span>
                        </td>
                        <td className="py-3 px-5 text-gray-500">
                          {c.vehicle === 'Car' ? '🚗 Bil' : c.vehicle === 'Motorcycle' ? '🏍️ Motorcykel' : c.vehicle === 'Moped' ? '🛵 Moped' : c.vehicle}
                        </td>
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
              <div className="flex flex-wrap justify-between items-center gap-3 mb-5">
                <div className="flex items-center gap-2">
                  <h2 className="font-bold text-gray-900">Pass ({sessions.length})</h2>
                  <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                    {(['all', 'public', 'school'] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() => setSessionFilter(f)}
                        className={clsx('px-3 py-1 text-xs rounded-md font-medium transition',
                          sessionFilter === f ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'
                        )}
                      >
                        {f === 'all' ? 'Alla' : f === 'public' ? 'Offentliga' : 'Skolkonto'}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => setShowAddSession(true)}
                  className="btn-primary flex items-center gap-2 text-sm py-2"
                >
                  <Plus className="w-4 h-4" />
                  {t('add_session')}
                </button>
              </div>
              <div className="space-y-3">
                {sessions
                  .filter((s) => sessionFilter === 'all' || s.visibility === sessionFilter)
                  .map((s) => (
                  <div key={s.id} className="bg-white rounded-xl border border-gray-100 p-4">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <div className="flex items-center gap-4">
                        <div className={clsx(
                          'w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm shrink-0',
                          s.course?.type === 'Risk1' ? 'bg-blue-100 text-swedish-blue' :
                          s.course?.type === 'Risk2' ? 'bg-orange-100 text-orange-700' :
                          s.course?.type === 'AM' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-600'
                        )}>
                          {s.course?.type === 'Risk1' ? 'R1' : s.course?.type === 'Risk2' ? 'R2' : s.course?.type === 'AM' ? 'AM' : s.course?.type?.slice(0, 2) || '?'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-gray-900">{locale === 'sv' ? s.course?.titleSv : s.course?.titleEn}</p>
                            <span className={clsx(
                              'px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1',
                              s.visibility === 'public' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                            )}>
                              {s.visibility === 'public' ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                              {s.visibility === 'public' ? 'Offentlig' : (s.assignedSchoolUser?.name ?? 'Skolkonto')}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-3 text-xs text-gray-500 mt-1">
                            <span>📅 {new Date(s.startTime).toLocaleDateString('sv-SE')}</span>
                            <span>🕐 {new Date(s.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – {new Date(s.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            <span>📍 {s.school?.name}</span>
                            <span>👤 {s.seatsAvailable}/{s.seatLimit} platser kvar</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 flex-wrap justify-end items-center">
                        <button
                          onClick={() => handleViewStudents(s.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-swedish-blue border border-swedish-blue rounded-lg hover:bg-blue-50 transition"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Visa elever
                        </button>

                        {/* Assign school */}
                        {assigningSchoolSession === s.id ? (
                          <div className="flex items-center gap-1.5">
                            <select
                              value={assignSchoolId}
                              onChange={(e) => setAssignSchoolId(e.target.value)}
                              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
                              autoFocus
                            >
                              <option value="">— Offentlig —</option>
                              {schoolAccounts.map((acc) => (
                                <option key={acc.id} value={String(acc.id)}>{acc.name}</option>
                              ))}
                            </select>
                            <button
                              onClick={() => handleAssignSchool(s.id)}
                              className="px-2.5 py-1.5 text-xs bg-swedish-blue text-white rounded-lg hover:bg-blue-700"
                            >Spara</button>
                            <button
                              onClick={() => { setAssigningSchoolSession(null); setAssignSchoolId(''); }}
                              className="px-2 py-1.5 text-xs text-gray-500 hover:text-gray-800"
                            ><X className="w-3.5 h-3.5" /></button>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setAssigningSchoolSession(s.id); setAssignSchoolId(s.assignedSchoolUserId ? String(s.assignedSchoolUserId) : ''); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition text-orange-600 border-orange-300 hover:bg-orange-50"
                          >
                            <School className="w-3.5 h-3.5" />
                            {s.assignedSchoolUser ? `Skola: ${s.assignedSchoolUser.name}` : 'Tilldela skola'}
                          </button>
                        )}

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
          {tab === 'bookings' && (() => {
            const groups: Record<string, Booking[]> = {};
            [...bookings].sort((a, b) => new Date(b.bookingTime).getTime() - new Date(a.bookingTime).getTime()).forEach((b) => {
              const key = new Date(b.bookingTime).toLocaleDateString('sv-SE', { year: 'numeric', month: 'long' });
              if (!groups[key]) groups[key] = [];
              groups[key].push(b);
            });
            const monthKeys = Object.keys(groups);
            return (
              <div>
                <div className="flex justify-between items-center mb-5">
                  <h2 className="font-bold text-gray-900">Alla bokningar ({bookings.length})</h2>
                  <button onClick={exportCsv} className="flex items-center gap-2 btn-outline text-sm py-2">
                    <Download className="w-4 h-4" />
                    {t('export_csv')}
                  </button>
                </div>
                {monthKeys.map((month) => (
                  <div key={month} className="mb-8">
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide capitalize">{month}</h3>
                      <div className="flex-1 h-px bg-gray-200" />
                      <span className="text-xs text-gray-400">{groups[month].length} bokningar</span>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                          <tr>
                            <th className="text-left py-3 px-4">ID</th>
                            <th className="text-left py-3 px-4">Namn</th>
                            <th className="text-left py-3 px-4">Personnummer</th>
                            <th className="text-left py-3 px-4">Telefon</th>
                            <th className="text-left py-3 px-4">E-post</th>
                            <th className="text-left py-3 px-4">Kurs & Pass</th>
                            <th className="text-left py-3 px-4">Status</th>
                            <th className="py-3 px-4" />
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {groups[month].map((b) => {
                            const name = getStudentName(b);
                            const phone = b.guestPhone ?? '–';
                            const email = b.guestEmail ?? (b.user as { email?: string } | null | undefined)?.email ?? '–';
                            const courseTitle = locale === 'sv' ? b.session?.course?.titleSv : b.session?.course?.titleEn;
                            const sessionDate = b.session ? new Date(b.session.startTime).toLocaleDateString('sv-SE') : '–';
                            const sessionTime = b.session ? new Date(b.session.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                            const schoolName = b.session?.school?.name ?? '';
                            return (
                              <tr key={b.id} className="hover:bg-gray-50">
                                <td className="py-3 px-4 text-gray-400 text-xs">#{b.id}</td>
                                <td className="py-3 px-4 font-medium">{name}</td>
                                <td className="py-3 px-4 text-gray-500 font-mono text-xs">{b.personnummer || '–'}</td>
                                <td className="py-3 px-4 text-gray-500 text-xs">{phone}</td>
                                <td className="py-3 px-4 text-gray-500 text-xs">{email}</td>
                                <td className="py-3 px-4">
                                  <p className="font-medium text-xs">{courseTitle}</p>
                                  <p className="text-xs text-gray-400">{sessionDate} {sessionTime} · {schoolName}</p>
                                </td>
                                <td className="py-3 px-4">
                                  <span className={clsx(
                                    'px-2.5 py-1 rounded-full text-xs font-semibold',
                                    b.status === 'Paid' ? 'bg-green-100 text-green-700' :
                                    b.status === 'Canceled' ? 'bg-red-100 text-red-700' :
                                    b.status === 'Confirmed' ? 'bg-blue-100 text-blue-700' :
                                    'bg-yellow-100 text-yellow-700'
                                  )}>{b.status}</span>
                                </td>
                                <td className="py-3 px-4">
                                  <div className="flex gap-1 justify-end">
                                    <button onClick={() => openEditBooking(b)} className="p-1.5 text-gray-400 hover:text-swedish-blue rounded-lg hover:bg-blue-50" title="Redigera">
                                      <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                    <button onClick={() => handleDeleteStudent(b.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50" title="Ta bort">
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}

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

          {/* Payments */}
          {tab === 'payments' && (() => {
            // Group payments by month
            const groups: Record<string, PaymentRecord[]> = {};
            payments.forEach((p) => {
              const key = new Date(p.createdAt).toLocaleDateString('sv-SE', { year: 'numeric', month: 'long' });
              if (!groups[key]) groups[key] = [];
              groups[key].push(p);
            });
            const monthKeys = Object.keys(groups);

            return (
              <div>
                <div className="flex items-center justify-between mb-5">
                  <h2 className="font-bold text-gray-900">Betalningar ({payments.length})</h2>
                  <div className="text-sm text-gray-500">
                    Totalt intjänat: <span className="font-semibold text-gray-900">
                      {payments.filter(p => p.status === 'Succeeded').reduce((s, p) => s + p.amount, 0).toLocaleString('sv-SE')} kr
                    </span>
                  </div>
                </div>

                {monthKeys.length === 0 && (
                  <div className="bg-white rounded-xl border border-gray-100 p-10 text-center text-gray-400">
                    Inga betalningar registrerade ännu.
                  </div>
                )}

                {monthKeys.map((month) => (
                  <div key={month} className="mb-8">
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide capitalize">{month}</h3>
                      <div className="flex-1 h-px bg-gray-200" />
                      <span className="text-sm text-gray-500">
                        {groups[month].filter(p => p.status === 'Succeeded').reduce((s, p) => s + p.amount, 0).toLocaleString('sv-SE')} kr
                      </span>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                          <tr>
                            <th className="text-left py-3 px-4">ID</th>
                            <th className="text-left py-3 px-4">Kund</th>
                            <th className="text-left py-3 px-4">Personnummer</th>
                            <th className="text-left py-3 px-4">Kurs</th>
                            <th className="text-left py-3 px-4">Datum</th>
                            <th className="text-left py-3 px-4">Swish-ref</th>
                            <th className="text-left py-3 px-4">Belopp</th>
                            <th className="text-left py-3 px-4">Status</th>
                            <th className="py-3 px-4" />
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {groups[month].map((p) => {
                            const name = p.booking.guestName ?? p.booking.user?.name ?? '–';
                            const courseDate = new Date(p.booking.session.startTime).toLocaleDateString('sv-SE');
                            return (
                              <tr key={p.id} className="hover:bg-gray-50">
                                <td className="py-3 px-4 text-gray-400">#{p.id}</td>
                                <td className="py-3 px-4 font-medium">{name}</td>
                                <td className="py-3 px-4 text-gray-500 font-mono text-xs">{p.booking.personnummer ?? '–'}</td>
                                <td className="py-3 px-4 text-gray-700">{p.booking.session.course.titleSv}</td>
                                <td className="py-3 px-4 text-gray-500">{courseDate}</td>
                                <td className="py-3 px-4 text-gray-400 font-mono text-xs truncate max-w-[120px]">{p.transactionId ?? '–'}</td>
                                <td className="py-3 px-4 font-semibold">{p.amount.toLocaleString('sv-SE')} kr</td>
                                <td className="py-3 px-4">
                                  <span className={clsx(
                                    'px-2.5 py-1 rounded-full text-xs font-semibold',
                                    p.status === 'Succeeded' ? 'bg-green-100 text-green-700' :
                                    p.status === 'Refunded' ? 'bg-orange-100 text-orange-700' :
                                    'bg-gray-100 text-gray-500'
                                  )}>
                                    {p.status === 'Succeeded' ? 'Betald' : p.status === 'Refunded' ? 'Återbetald' : p.status}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-right">
                                  {p.status === 'Succeeded' && (
                                    <button
                                      onClick={() => setRefundTarget(p)}
                                      className="flex items-center gap-1.5 text-xs text-red-600 hover:text-red-800 font-medium transition"
                                    >
                                      <RotateCcw className="w-3.5 h-3.5" />
                                      Återbetala
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Info Cards */}
          {tab === 'cards' && (
            <div>
              <div className="flex justify-between items-center mb-5">
                <h2 className="font-bold text-gray-900">Informationskort ({infoCards.length})</h2>
                <button
                  onClick={() => { setShowAddCard(true); setCardForm(emptyCardForm); setEditCard(null); setCardPreviewUrl(''); }}
                  className="btn-primary flex items-center gap-2 text-sm py-2"
                >
                  <Plus className="w-4 h-4" />
                  Lägg till kort
                </button>
              </div>

              {/* Card list */}
              <div className="space-y-4 mb-6">
                {infoCards.map((card) => (
                  <div key={card.id} className={clsx('bg-white rounded-2xl border border-gray-100 overflow-hidden flex shadow-sm', !card.visible && 'opacity-50')}>
                    {/* Thumbnail */}
                    <div className="w-32 shrink-0 bg-gray-100 relative">
                      {card.videoUrl ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 text-white text-xs font-medium gap-1"><Video className="w-4 h-4" />Video</div>
                      ) : card.imageUrl ? (
                        <img src={card.imageUrl} alt={card.title} className="absolute inset-0 w-full h-full object-cover" />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-gray-300"><ImagePlus className="w-8 h-8" /></div>
                      )}
                    </div>
                    {/* Info */}
                    <div className="flex-1 p-4 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          {card.badge && <span className="text-xs text-swedish-blue font-medium">{card.badge}</span>}
                          <h3 className="font-bold text-gray-900 text-sm truncate">{card.title}</h3>
                          <p className="text-gray-500 text-xs line-clamp-1 mt-0.5">{card.description}</p>
                          {card.price && <p className="text-orange-600 text-xs font-semibold mt-1">{card.price}</p>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={clsx('text-xs font-medium px-2 py-0.5 rounded-full', card.visible ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500')}>
                            {card.visible ? 'Synlig' : 'Dold'}
                          </span>
                          <button onClick={() => openEditCard(card)} className="p-1.5 text-gray-400 hover:text-swedish-blue rounded-lg hover:bg-blue-50"><Pencil className="w-4 h-4" /></button>
                          <button onClick={() => handleDeleteCard(card.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {infoCards.length === 0 && (
                  <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-400">
                    <Tag className="w-10 h-10 mx-auto mb-3 text-gray-200" />
                    <p className="text-sm">Inga informationskort ännu. Klicka på "Lägg till kort" för att börja.</p>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </main>

      {/* Edit Booking Modal */}
      {editBooking && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-lg">Redigera bokning #{editBooking.id}</h3>
              <button onClick={() => setEditBooking(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Namn</label>
                <input type="text" className="input-field" value={editForm.guestName} onChange={(e) => setEditForm({ ...editForm, guestName: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Personnummer</label>
                <input type="text" className="input-field font-mono" value={editForm.personnummer} onChange={(e) => setEditForm({ ...editForm, personnummer: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Telefon</label>
                <input type="tel" className="input-field" value={editForm.guestPhone} onChange={(e) => setEditForm({ ...editForm, guestPhone: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">E-post</label>
                <input type="email" className="input-field" value={editForm.guestEmail} onChange={(e) => setEditForm({ ...editForm, guestEmail: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Status</label>
                <select className="input-field" value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}>
                  <option value="Pending">Pending</option>
                  <option value="Confirmed">Confirmed</option>
                  <option value="Paid">Paid</option>
                  <option value="Canceled">Canceled</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setEditBooking(null)} className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl hover:bg-gray-50 text-sm">Avbryt</button>
              <button
                onClick={handleEditBookingSave}
                disabled={editSaving}
                className="flex-1 btn-primary py-2.5 text-sm flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {editSaving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
                {editSaving ? 'Sparar...' : 'Spara ändringar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Refund Confirm Modal */}
      {refundTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="font-bold text-gray-900">Bekräfta återbetalning</h3>
            </div>
            <p className="text-sm text-gray-600 mb-2">
              Är du säker på att du vill återbetala{' '}
              <strong>{refundTarget.amount.toLocaleString('sv-SE')} kr</strong> till{' '}
              <strong>{refundTarget.booking.guestName ?? refundTarget.booking.user?.name ?? 'kunden'}</strong>?
            </p>
            <p className="text-xs text-gray-400 mb-6">
              Bokning #{refundTarget.bookingId} kommer att avbokas och platsen återställas. Återbetalningen i Swish måste hanteras manuellt i Swish-appen.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setRefundTarget(null)}
                disabled={refunding}
                className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl hover:bg-gray-50 text-sm font-medium disabled:opacity-50"
              >
                Avbryt
              </button>
              <button
                onClick={handleConfirmRefund}
                disabled={refunding}
                className="flex-1 bg-red-600 text-white py-2.5 rounded-xl hover:bg-red-700 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {refunding ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <RotateCcw className="w-4 h-4" />
                )}
                {refunding ? 'Bearbetar...' : 'Bekräfta återbetalning'}
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* Add/Edit Info Card Modal */}
      {(showAddCard || editCard) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
              <h3 className="font-bold text-lg">{editCard ? 'Redigera kort' : 'Nytt kort'}</h3>
              <button onClick={() => { setShowAddCard(false); setEditCard(null); setCardPreviewUrl(''); }} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
              {/* Badge */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Badge-text <span className="text-gray-400 font-normal">(valfri)</span></label>
                <input type="text" className="input-field" placeholder="t.ex. Sveriges ledande riskutbildning" value={cardForm.badge} onChange={(e) => setCardForm({ ...cardForm, badge: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Rubrik *</label>
                <input type="text" className="input-field" placeholder="Riskutbildning för körkort A & B" value={cardForm.title} onChange={(e) => setCardForm({ ...cardForm, title: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Beskrivning *</label>
                <textarea rows={3} className="input-field resize-none" placeholder="Teori och praktik på vår moderna halkbana..." value={cardForm.description} onChange={(e) => setCardForm({ ...cardForm, description: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Pris <span className="text-gray-400 font-normal">(valfri)</span></label>
                <input type="text" className="input-field" placeholder="2 500 kr" value={cardForm.price} onChange={(e) => setCardForm({ ...cardForm, price: e.target.value })} />
              </div>

              {/* Buttons */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <p className="text-sm font-semibold text-gray-700">Knappar</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Primär knapptext</label>
                    <input type="text" className="input-field text-sm" placeholder="Våra kurser" value={cardForm.primaryButtonText} onChange={(e) => setCardForm({ ...cardForm, primaryButtonText: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Primär länk</label>
                    <input type="text" className="input-field text-sm" placeholder="/courses" value={cardForm.primaryButtonLink} onChange={(e) => setCardForm({ ...cardForm, primaryButtonLink: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Sekundär knapptext <span className="text-gray-400">(valfri)</span></label>
                    <input type="text" className="input-field text-sm" placeholder="Boka riskutbildning" value={cardForm.secondaryButtonText} onChange={(e) => setCardForm({ ...cardForm, secondaryButtonText: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Sekundär länk</label>
                    <input type="text" className="input-field text-sm" placeholder="/courses" value={cardForm.secondaryButtonLink} onChange={(e) => setCardForm({ ...cardForm, secondaryButtonLink: e.target.value })} />
                  </div>
                </div>
              </div>

              {/* Media */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-4">
                <p className="text-sm font-semibold text-gray-700">Media <span className="text-gray-400 font-normal">(bild eller video)</span></p>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-2">Ladda upp bild</label>
                  <div
                    onClick={() => cardFileRef.current?.click()}
                    className={clsx('relative rounded-xl overflow-hidden border-2 border-dashed cursor-pointer transition group', cardForm.imageUrl && !cardForm.videoUrl ? 'border-transparent' : 'border-gray-300 hover:border-swedish-blue bg-white')}
                    style={{ height: '140px' }}
                  >
                    {cardForm.imageUrl && !cardForm.videoUrl ? (
                      <>
                        <img src={cardForm.imageUrl} alt="Förhandsgranskning" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition flex items-center justify-center opacity-0 group-hover:opacity-100">
                          <span className="text-white text-sm font-semibold flex items-center gap-2"><ImagePlus className="w-4 h-4" />Byt bild</span>
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
                        <ImagePlus className="w-7 h-7" /><span className="text-sm">Klicka för att välja bild</span><span className="text-xs">JPG, PNG, WebP · Max 5 MB</span>
                      </div>
                    )}
                  </div>
                  <input ref={cardFileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handleCardFileChange} />
                </div>
                <div className="flex items-center gap-3 text-gray-400">
                  <div className="flex-1 h-px bg-gray-200" /><span className="text-xs font-medium">ELLER</span><div className="flex-1 h-px bg-gray-200" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Video-URL (MP4)</label>
                  <input type="url" className="input-field text-sm" placeholder="https://example.com/video.mp4" value={cardForm.videoUrl} onChange={(e) => setCardForm({ ...cardForm, videoUrl: e.target.value, imageUrl: e.target.value ? '' : cardForm.imageUrl })} />
                  <p className="text-xs text-gray-400 mt-1">Video används istället för bild om den anges.</p>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Sortering</label>
                  <input type="number" className="input-field w-24" value={cardForm.sortOrder} onChange={(e) => setCardForm({ ...cardForm, sortOrder: parseInt(e.target.value) || 0 })} />
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-gray-700">Synlig</label>
                  <button type="button" onClick={() => setCardForm({ ...cardForm, visible: !cardForm.visible })} className={clsx('relative inline-flex h-6 w-11 rounded-full transition-colors', cardForm.visible ? 'bg-swedish-blue' : 'bg-gray-300')}>
                    <span className={clsx('inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform mt-1', cardForm.visible ? 'translate-x-6' : 'translate-x-1')} />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex gap-3 px-6 py-4 border-t border-gray-100 shrink-0">
              <button onClick={() => { setShowAddCard(false); setEditCard(null); }} className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl hover:bg-gray-50 text-sm">Avbryt</button>
              <button
                onClick={handleSaveCard}
                disabled={cardSaving || !cardForm.title || !cardForm.description}
                className="flex-1 btn-primary py-2.5 text-sm flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {cardSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {cardSaving ? 'Sparar...' : editCard ? 'Spara ändringar' : 'Skapa kort'}
              </button>
            </div>
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
                    <option value="AM">AM-kurs (Moped)</option>
                    <option value="Intro">Introduktionskurs</option>
                    <option value="Other">Övrigt</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Fordon</label>
                  <select className="input-field" value={newCourse.vehicle} onChange={(e) => setNewCourse({ ...newCourse, vehicle: e.target.value })}>
                    <option value="Car">Bil</option>
                    <option value="Motorcycle">Motorcykel</option>
                    <option value="Moped">Moped</option>
                    <option value="Other">Övrigt</option>
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
                  <select className="input-field" value={newSession.visibility} onChange={(e) => setNewSession({ ...newSession, visibility: e.target.value, assignedSchoolUserId: '' })}>
                    <option value="public">Offentlig</option>
                    <option value="school">Skolkonto</option>
                  </select>
                </div>
              </div>
              {newSession.visibility === 'school' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Tilldela trafikskola</label>
                  <select className="input-field" value={newSession.assignedSchoolUserId} onChange={(e) => setNewSession({ ...newSession, assignedSchoolUserId: e.target.value })} required>
                    <option value="">Välj trafikskola...</option>
                    {schoolAccounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>{acc.name}</option>
                    ))}
                  </select>
                  {schoolAccounts.length === 0 && (
                    <p className="text-xs text-orange-500 mt-1">Inga trafikskola-konton skapade ännu. Gå till fliken Trafikskolor.</p>
                  )}
                </div>
              )}
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
