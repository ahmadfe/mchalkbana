'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import type { Session } from '@/lib/types';
import {
  Calendar, Users, X, Plus, Building2, Trash2, CheckCircle2, ChevronRight,
  BarChart2, Lock, MapPin, Clock, MessageSquare, AlarmClock, Mail, Phone, FileText, Download,
} from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '@/context/AuthContext';
import { InstallAppButton } from '@/components/pwa';
import { courseKind, type CourseKind } from '@/lib/courseKind';

interface StudentForm {
  name: string;
  personnummer: string;
  phone: string;
  email: string;
  note: string;
  sendConfirmation: boolean;
}

interface SchoolBooking {
  id: number;
  guestName: string | null;
  personnummer: string | null;
  guestPhone: string | null;
  guestEmail: string | null;
  note: string | null;
  status: string;
  bookingTime: string;
  session: Session & { course: { titleSv: string; titleEn: string } };
}

interface Reservation { meetingPlace: string; fillBy: string | null; message: string; released: boolean }

/** Allt som behövs för att visa ett pass – i listan och i detaljvyn. */
interface PassItem {
  id: number;
  session: Session;
  title: string;
  start: Date;
  end: Date;
  students: SchoolBooking[];
  meetingPlace: string;
  /** Arkiverade pass går inte att ändra */
  readOnly: boolean;
  myAllocation: number | null;
  remaining: number;
  full: boolean;
  deadlinePassed: boolean;
  locked: boolean;
  reservation: Reservation | null;
  price?: number;
  customPrice: boolean;
}

const tz = { timeZone: 'Europe/Stockholm' } as const;
const hm = (d: Date) => d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', ...tz });
const emptyStudent = (): StudentForm => ({ name: '', personnummer: '', phone: '', email: '', note: '', sendConfirmation: false });

export default function SchoolPage() {
  const locale = useLocale();
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();

  const [sessions, setSessions] = useState<Session[]>([]);
  const [bookings, setBookings] = useState<SchoolBooking[]>([]);
  const [priceMap, setPriceMap] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'upcoming' | 'archived'>('upcoming');
  // Valt pass: öppet kort på mobilen, detaljvyn till höger på surfplatta/dator
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // Lägg till elever
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [activeRemaining, setActiveRemaining] = useState(0);
  const [students, setStudents] = useState<StudentForm[]>([emptyStudent()]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const loadData = useCallback(async () => {
    const [sessionsRes, bookingsRes, pricesRes] = await Promise.all([
      fetch('/api/sessions?includeSchool=true'),
      fetch('/api/school/bookings'),
      fetch('/api/school/prices'),
    ]);
    const [sessionsData, bookingsData, pricesData] = await Promise.all([
      sessionsRes.json(),
      bookingsRes.json(),
      pricesRes.json(),
    ]);
    setSessions(sessionsData.sessions || []);
    setBookings(bookingsData.bookings || []);
    setPriceMap(pricesData.priceMap || {});
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!authLoading && !user) { router.push(`/${locale}/login`); return; }
    if (!authLoading && user && user.role !== 'school' && user.role !== 'admin') {
      router.push(`/${locale}`); return;
    }
    if (!authLoading && user) loadData();
  }, [user, authLoading, locale, router, loadData]);

  const openModal = (session: Session, remaining: number) => {
    setActiveSession(session);
    setActiveRemaining(remaining);
    setStudents([emptyStudent()]);
    setSaveError('');
    setSaveSuccess(false);
  };

  const addStudentRow = () => setStudents((p) => [...p, emptyStudent()]);
  const removeStudentRow = (i: number) => setStudents((p) => p.filter((_, idx) => idx !== i));
  const updateStudentRow = (i: number, field: keyof StudentForm, value: string | boolean) =>
    setStudents((p) => p.map((s, idx) => idx === i ? { ...s, [field]: value } : s));

  const handleSaveStudents = async () => {
    if (!activeSession) return;
    const valid = students.every((s) => s.name.trim() && s.personnummer.trim());
    if (!valid) { setSaveError('Namn och personnummer krävs för alla elever.'); return; }

    setSaving(true);
    setSaveError('');

    for (const student of students) {
      const res = await fetch('/api/school/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: activeSession.id,
          guestName: student.name,
          personnummer: student.personnummer,
          guestPhone: student.phone || null,
          guestEmail: student.email || null,
          sendConfirmation: student.sendConfirmation,
          note: student.note,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setSaveError(`Fel för ${student.name}: ${data.error}`);
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    setSaveSuccess(true);
    await loadData();
    setSelectedId(activeSession.id);
    setTimeout(() => {
      setActiveSession(null);
      setSaveSuccess(false);
    }, 1200);
  };

  const handleDeleteStudent = async (bookingId: number) => {
    await fetch(`/api/school/bookings/${bookingId}`, { method: 'DELETE' });
    await loadData();
  };

  const bookingsBySession = bookings.reduce<Record<number, SchoolBooking[]>>((acc, b) => {
    (acc[b.session.id] ??= []).push(b);
    return acc;
  }, {});

  const titleOf = (s: Session) => (locale === 'sv' ? s.course?.titleSv : s.course?.titleEn) ?? '';

  const upcoming: PassItem[] = sessions.map((s) => {
    const list = bookingsBySession[s.id] || [];
    const myAllocation = (s as { myAllocation?: number | null }).myAllocation ?? null;
    const reservation = (s as { myReservation?: Reservation | null }).myReservation ?? null;
    const full = myAllocation !== null ? list.length >= myAllocation : s.seatsAvailable === 0;
    // Efter "fyll senast" kan skolan inte lägga till fler elever
    const deadlinePassed = !!reservation && (reservation.released || (!!reservation.fillBy && new Date(reservation.fillBy) < new Date()));
    const custom = s.course?.id !== undefined ? priceMap[s.course.id] : undefined;
    return {
      id: s.id, session: s, title: titleOf(s), start: new Date(s.startTime), end: new Date(s.endTime), students: list,
      meetingPlace: reservation?.meetingPlace || s.meetingPlace || s.course?.location || s.school?.name || '',
      readOnly: false, myAllocation, remaining: myAllocation !== null ? myAllocation - list.length : s.seatsAvailable,
      full, deadlinePassed, locked: full || deadlinePassed, reservation,
      price: custom ?? s.course?.price, customPrice: custom !== undefined,
    };
  });

  // Arkiverade pass = pass där skolan har elever och som redan har börjat. De går inte att ändra.
  const archived: PassItem[] = Object.values(bookingsBySession)
    .filter((list) => new Date(list[0].session.startTime) <= new Date())
    .map((list) => {
      const s = list[0].session;
      return {
        id: s.id, session: s, title: titleOf(s), start: new Date(s.startTime), end: new Date(s.endTime), students: list,
        meetingPlace: s.meetingPlace || s.course?.location || s.school?.name || '',
        readOnly: true, myAllocation: null, remaining: 0, full: false, deadlinePassed: false, locked: true, reservation: null, customPrice: false,
      };
    })
    .sort((a, b) => b.start.getTime() - a.start.getTime());

  const items = view === 'upcoming' ? upcoming : archived;
  const selected = items.find((i) => i.id === selectedId) ?? null;
  // Surfplatta/dator visar alltid ett pass till höger – det valda eller det första
  const shown = selected ?? items[0] ?? null;

  const now = new Date();
  const studentsThisMonth = bookings.filter((b) => {
    const d = new Date(b.bookingTime);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }).length;

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-swedish-blue border-t-transparent rounded-full animate-spin" />
        </main>
      </div>
    );
  }

  const detail = (item: PassItem) => (
    <PassDetail item={item} onAdd={() => openModal(item.session, item.remaining)} onDelete={item.readOnly ? undefined : handleDeleteStudent} />
  );

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />

      <main className="flex-1 pt-6 pb-[calc(2rem+env(safe-area-inset-bottom))]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-5">

          {/* Rubrik */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-swedish-blue flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5 text-swedish-yellow" />
            </div>
            <div className="min-w-0">
              <h1 className="font-headline text-2xl font-extrabold text-gray-900 truncate">{user?.name}</h1>
              <p className="text-sm text-gray-500">Trafikskolekonto · faktureras den 26:e varje månad</p>
            </div>
            <InstallAppButton className="ml-auto hidden sm:inline-flex" />
          </div>

          {/* Siffror */}
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            <Stat icon={<Calendar className="w-5 h-5 text-swedish-blue" />} tint="bg-brand-100" value={sessions.length} label="Tillgängliga pass" />
            <Stat icon={<Users className="w-5 h-5 text-green-600" />} tint="bg-green-100" value={bookings.length} label="Bokade elever" />
            <Stat icon={<BarChart2 className="w-5 h-5 text-purple-600" />} tint="bg-purple-100" value={studentsThisMonth} label="Denna månad" />
          </div>
          <InstallAppButton className="w-full sm:hidden" />

          {/* Kommande / Arkiverade */}
          <div className="flex p-1 rounded-2xl bg-gray-200/70 sm:max-w-sm">
            {([['upcoming', 'Kommande'], ['archived', `Arkiverade (${archived.length})`]] as const).map(([v, label]) => (
              <button
                key={v}
                onClick={() => { setView(v); setSelectedId(null); }}
                className={clsx('flex-1 h-10 rounded-xl text-sm font-semibold transition', view === v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800')}
              >
                {label}
              </button>
            ))}
          </div>

          {items.length === 0 ? (
            <div className="text-center py-16 px-6 text-gray-500 bg-white rounded-3xl border border-gray-100">
              <Calendar className="w-10 h-10 mx-auto mb-3 text-gray-300" />
              {view === 'upcoming' ? (
                <>
                  <p className="font-semibold text-gray-700">Inga tillgängliga pass</p>
                  <p className="text-sm mt-1">Kontakta oss för att få platser på ett pass.</p>
                </>
              ) : (
                <>
                  <p className="font-semibold text-gray-700">Inga arkiverade pass än</p>
                  <p className="text-sm mt-1">Pass hamnar här när de har börjat.</p>
                </>
              )}
            </div>
          ) : (
            <div className="md:grid md:grid-cols-[minmax(0,320px)_minmax(0,1fr)] lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] md:gap-5 md:items-start">
              {/* Passlista */}
              <div className="space-y-2">
                {view === 'archived' && (
                  <p className="text-xs text-gray-500 px-1 pb-1">Passen har börjat eller är genomförda och kan inte ändras. Kontakta oss om något behöver rättas.</p>
                )}
                {items.map((item) => {
                  const open = selectedId === item.id;
                  return (
                    <div key={item.id}>
                      <PassCard
                        item={item}
                        open={open}
                        active={shown?.id === item.id}
                        onClick={() => setSelectedId(open ? null : item.id)}
                      />
                      {/* Mobil: detaljerna öppnas under kortet */}
                      {open && <div className="md:hidden mt-2">{detail(item)}</div>}
                    </div>
                  );
                })}
              </div>

              {/* Surfplatta/dator: valt pass bredvid listan */}
              {shown && <div className="hidden md:block md:sticky md:top-[calc(6rem+env(safe-area-inset-top))]">{detail(shown)}</div>}
            </div>
          )}

          <SchoolInvoices />

          <MonthlyReport bookings={bookings} />
        </div>
      </main>

      {/* Lägg till elever – glider upp från botten på mobilen */}
      {activeSession && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" onClick={() => !saving && setActiveSession(null)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Lägg till elever"
            onClick={(e) => e.stopPropagation()}
            className="sheet bg-white text-gray-900 rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-6 max-w-xl w-full shadow-2xl max-h-[92dvh] flex flex-col"
          >
            <div className="flex items-start justify-between gap-3 mb-4 pt-2 sm:pt-0">
              <div className="min-w-0">
                <h3 className="font-headline font-extrabold text-xl">Lägg till elever</h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  {titleOf(activeSession)} · {new Date(activeSession.startTime).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', ...tz })} · {activeRemaining} {activeRemaining === 1 ? 'plats' : 'platser'} kvar
                </p>
              </div>
              <button onClick={() => setActiveSession(null)} aria-label="Stäng" className="w-10 h-10 -mr-2 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500 shrink-0">
                <X className="w-5 h-5" />
              </button>
            </div>

            {saveSuccess ? (
              <div className="flex-1 flex flex-col items-center justify-center py-10 text-center">
                <CheckCircle2 className="w-12 h-12 text-green-500 mb-3" />
                <p className="font-semibold text-gray-900">Eleverna är tillagda!</p>
              </div>
            ) : (
              <>
                <div className="overflow-auto flex-1 space-y-3 -mx-1 px-1">
                  {saveError && (
                    <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
                      {saveError}
                    </div>
                  )}
                  {students.map((s, i) => (
                    <div key={i} className="rounded-2xl bg-gray-50 border border-gray-100 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-gray-700">Elev {i + 1}</span>
                        {students.length > 1 && (
                          <button onClick={() => removeStudentRow(i)} aria-label={`Ta bort elev ${i + 1}`} className="w-9 h-9 -mr-2 rounded-full text-gray-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center">
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <div className="grid sm:grid-cols-2 gap-3">
                        <Labeled label="Namn *">
                          <input type="text" className="input-field bg-white" placeholder="Anna Svensson" autoComplete="off" value={s.name} onChange={(e) => updateStudentRow(i, 'name', e.target.value)} />
                        </Labeled>
                        <Labeled label="Personnummer *">
                          <input type="text" inputMode="numeric" className="input-field bg-white font-mono" placeholder="ÅÅÅÅMMDD-XXXX" autoComplete="off" value={s.personnummer} onChange={(e) => updateStudentRow(i, 'personnummer', e.target.value)} />
                        </Labeled>
                        <Labeled label="Telefon">
                          <input type="tel" className="input-field bg-white" placeholder="070-123 45 67" value={s.phone} onChange={(e) => updateStudentRow(i, 'phone', e.target.value)} />
                        </Labeled>
                        <Labeled label="E-post">
                          <input type="email" className="input-field bg-white" placeholder="anna@skola.se" value={s.email} onChange={(e) => updateStudentRow(i, 'email', e.target.value)} />
                        </Labeled>
                        <Labeled label="Anteckning" className="sm:col-span-2">
                          <textarea
                            className="input-field bg-white min-h-[64px]"
                            placeholder="Valfritt – t.ex. behöver tolk, kommer lite sent, referens för fakturan"
                            maxLength={500}
                            value={s.note}
                            onChange={(e) => updateStudentRow(i, 'note', e.target.value)}
                          />
                        </Labeled>
                      </div>
                      {s.email && (
                        <label className="flex items-center gap-2.5 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            className="w-5 h-5 rounded accent-swedish-blue"
                            checked={s.sendConfirmation}
                            onChange={(e) => updateStudentRow(i, 'sendConfirmation', e.target.checked)}
                          />
                          <span className="text-sm text-gray-600">Skicka bokningsbekräftelse via e-post</span>
                        </label>
                      )}
                    </div>
                  ))}
                  <button
                    onClick={addStudentRow}
                    disabled={students.length >= activeRemaining}
                    className="w-full h-12 flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-2xl text-sm font-semibold text-gray-500 hover:border-swedish-blue hover:text-swedish-blue transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Plus className="w-4 h-4" />Lägg till fler elever
                  </button>
                </div>

                <div className="flex gap-3 pt-4 mt-3 border-t border-gray-100">
                  <button onClick={() => setActiveSession(null)} className="h-12 px-6 rounded-full bg-gray-100 text-gray-700 font-semibold hover:bg-gray-200">
                    Avbryt
                  </button>
                  <button
                    onClick={handleSaveStudents}
                    disabled={saving}
                    className="flex-1 h-12 rounded-full bg-swedish-blue text-white font-bold hover:bg-swedish-dark disabled:opacity-60"
                  >
                    {saving ? 'Sparar…' : `Spara ${students.length} elev${students.length !== 1 ? 'er' : ''}`}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ icon, tint, value, label }: { icon: React.ReactNode; tint: string; value: number; label: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
      <div className={clsx('w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0', tint)}>{icon}</div>
      <div className="min-w-0">
        <p className="font-headline text-2xl font-extrabold text-gray-900 leading-none">{value}</p>
        <p className="text-xs text-gray-500 mt-1">{label}</p>
      </div>
    </div>
  );
}

function Labeled({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={clsx('block', className)}>
      <span className="block text-xs font-semibold text-gray-600 mb-1">{label}</span>
      {children}
    </label>
  );
}

const KIND: Record<CourseKind, { label: string; cls: string }> = {
  risk1: { label: 'R1', cls: 'bg-brand-100 text-swedish-dark' },
  risk2: { label: 'R2', cls: 'bg-orange-100 text-orange-700' },
  kombo: { label: 'R1+2', cls: 'bg-purple-100 text-purple-700' },
  other: { label: 'Kurs', cls: 'bg-gray-100 text-gray-600' },
};

/** Ett pass i listan: datum, kurs, tid och hur många platser som är fyllda. */
function PassCard({ item, open, active, onClick }: { item: PassItem; open: boolean; active: boolean; onClick: () => void }) {
  const kind = KIND[courseKind(item.session.course?.type ?? '')];
  const status = item.readOnly
    ? `${item.students.length} elev${item.students.length === 1 ? '' : 'er'}`
    : item.myAllocation !== null
      ? `${item.students.length} av ${item.myAllocation} platser`
      : `${item.session.seatsAvailable} platser kvar`;
  return (
    <button
      onClick={onClick}
      className={clsx(
        'w-full text-left flex items-center gap-3 rounded-2xl border p-3 sm:p-4 transition bg-white',
        open ? 'border-swedish-blue ring-1 ring-swedish-blue' : 'border-gray-100 hover:border-gray-200',
        active && 'md:border-swedish-blue md:ring-1 md:ring-swedish-blue',
        !active && 'md:border-gray-100 md:ring-0',
      )}
    >
      <div className="w-12 shrink-0 text-center rounded-xl bg-gray-50 py-1.5">
        <p className="text-[11px] font-semibold uppercase text-gray-500 leading-none">{item.start.toLocaleDateString('sv-SE', { month: 'short', ...tz }).replace('.', '')}</p>
        <p className="font-headline text-xl font-extrabold text-gray-900 leading-tight">{item.start.toLocaleDateString('sv-SE', { day: 'numeric', ...tz })}</p>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={clsx('text-[11px] font-bold px-1.5 py-0.5 rounded-md shrink-0', kind.cls)}>{kind.label}</span>
          <p className="font-semibold text-gray-900 truncate">{item.title}</p>
        </div>
        <p className="text-sm text-gray-500 mt-0.5 truncate">
          {item.start.toLocaleDateString('sv-SE', { weekday: 'short', ...tz })} {hm(item.start)}–{hm(item.end)}
        </p>
        <p className={clsx('text-xs font-semibold mt-1', item.readOnly ? 'text-gray-400' : item.locked ? 'text-red-500' : 'text-green-600')}>
          {item.readOnly ? <><Lock className="inline w-3 h-3 -mt-0.5" /> {item.end < new Date() ? 'Genomfört' : 'Pågår'} · {status}</> : item.deadlinePassed ? `Stängt · ${status}` : status}
        </p>
      </div>
      <ChevronRight className={clsx('w-5 h-5 text-gray-300 shrink-0 transition md:rotate-0', open && 'rotate-90')} />
    </button>
  );
}

/** Ett pass i detalj: plats, pris, meddelande och skolans elever. */
function PassDetail({ item, onAdd, onDelete }: { item: PassItem; onAdd: () => void; onDelete?: (bookingId: number) => void }) {
  const r = item.reservation;
  return (
    <div className="bg-white rounded-3xl border border-gray-100 p-5 space-y-4">
      <div>
        <h2 className="font-headline text-xl font-extrabold text-gray-900">{item.title}</h2>
        <p className="text-sm text-gray-600 mt-1 capitalize">
          {item.start.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long', ...tz })}
        </p>
      </div>

      <div className="space-y-2 text-sm text-gray-700">
        <p className="flex items-center gap-2"><Clock className="w-4 h-4 text-gray-400 shrink-0" />{hm(item.start)}–{hm(item.end)}</p>
        {item.meetingPlace && <p className="flex items-start gap-2"><MapPin className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />{item.meetingPlace}</p>}
        {item.price !== undefined && (
          <p className="flex items-center gap-2">
            <span className="w-4 text-center text-gray-400 font-bold shrink-0">kr</span>
            <span className="font-semibold">{item.price.toLocaleString('sv-SE')} kr/elev</span>
            {item.customPrice && <span className="text-xs text-swedish-dark">(ert pris)</span>}
          </p>
        )}
        {r?.fillBy && (
          <p className={clsx('flex items-center gap-2', item.deadlinePassed ? 'text-gray-400' : 'text-amber-700 font-medium')}>
            <AlarmClock className="w-4 h-4 shrink-0" />
            {item.deadlinePassed ? 'Stängt' : 'Fyll senast'} {new Date(r.fillBy).toLocaleDateString('sv-SE', { day: 'numeric', month: 'long', ...tz })}
          </p>
        )}
      </div>

      {r?.message && (
        <p className="text-sm text-gray-700 bg-gray-50 rounded-2xl px-4 py-3 whitespace-pre-wrap flex gap-2">
          <MessageSquare className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />{r.message}
        </p>
      )}

      {!item.readOnly && (
        <div>
          {item.myAllocation !== null && (
            <div className="mb-3">
              <div className="flex justify-between text-xs font-semibold text-gray-500 mb-1.5">
                <span>Era platser</span>
                <span>{item.students.length} av {item.myAllocation} fyllda</span>
              </div>
              <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                <div className={clsx('h-full rounded-full', item.full ? 'bg-green-500' : 'bg-swedish-blue')} style={{ width: `${Math.min(100, (item.students.length / Math.max(1, item.myAllocation)) * 100)}%` }} />
              </div>
            </div>
          )}
          <button
            disabled={item.locked}
            onClick={onAdd}
            className="w-full h-12 rounded-full bg-swedish-blue text-white font-bold inline-flex items-center justify-center gap-2 hover:bg-swedish-dark disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
          >
            <Plus className="w-5 h-5" />
            {item.deadlinePassed ? 'Stängt för nya elever' : item.full ? 'Fullbokat' : 'Lägg till elever'}
          </button>
        </div>
      )}

      <div>
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-gray-400 mb-2">
          Era elever ({item.students.length})
        </p>
        {item.students.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">Inga elever bokade på detta pass ännu.</p>
        ) : (
          <ul className="space-y-2">
            {item.students.map((b) => (
              <li key={b.id} className="rounded-2xl bg-gray-50 px-4 py-3 flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-gray-900">{b.guestName || '–'}</p>
                  <p className="text-sm font-mono text-gray-600">{b.personnummer || '–'}</p>
                  {(b.guestPhone || b.guestEmail?.includes('@')) && (
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-500 mt-1">
                      {b.guestPhone && <span className="inline-flex items-center gap-1"><Phone className="w-3 h-3" />{b.guestPhone}</span>}
                      {b.guestEmail?.includes('@') && <span className="inline-flex items-center gap-1 break-all"><Mail className="w-3 h-3 shrink-0" />{b.guestEmail}</span>}
                    </div>
                  )}
                  {b.note && <p className="text-xs text-amber-800 bg-amber-50 rounded-lg px-2.5 py-1.5 mt-2 whitespace-pre-wrap">📝 {b.note}</p>}
                </div>
                {onDelete && (
                  <button
                    onClick={() => confirm(`Ta bort ${b.guestName || 'eleven'} från passet?`) && onDelete(b.id)}
                    aria-label={`Ta bort ${b.guestName || 'eleven'}`}
                    className="w-10 h-10 -mr-2 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 flex items-center justify-center shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** Antal bokade elever per månad. */
function MonthlyReport({ bookings }: { bookings: SchoolBooking[] }) {
  const buckets: Record<string, number> = {};
  for (const b of bookings) {
    const d = new Date(b.bookingTime);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    buckets[key] = (buckets[key] || 0) + 1;
  }
  const sorted = Object.entries(buckets).sort((a, b) => b[0].localeCompare(a[0]));
  const max = Math.max(1, ...sorted.map(([, v]) => v));
  return (
    <div className="bg-white rounded-3xl border border-gray-100 p-5">
      <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
        <BarChart2 className="w-4 h-4 text-gray-400" /> Elever per månad
      </h2>
      {sorted.length === 0 ? (
        <p className="text-sm text-gray-400 py-4 text-center">Inga bokningar ännu.</p>
      ) : (
        <ul className="space-y-3">
          {sorted.map(([month, count]) => {
            const [year, mon] = month.split('-');
            const label = new Date(Number(year), Number(mon) - 1, 1).toLocaleDateString('sv-SE', { year: 'numeric', month: 'long' });
            return (
              <li key={month} className="grid grid-cols-[7.5rem_2rem_1fr] items-center gap-3 text-sm">
                <span className="capitalize text-gray-700">{label}</span>
                <span className="font-bold text-swedish-dark text-right">{count}</span>
                <span className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <span className="block h-full bg-swedish-blue rounded-full" style={{ width: `${Math.round((count / max) * 100)}%` }} />
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

interface SchoolInvoice { id: number; number: number; period: string; status: string; issueDate: string; dueDate: string; total: number; paidAt: string | null; creditOfId: number | null }

/** Skolans fakturor med PDF att ladda ner. */
function SchoolInvoices() {
  const [list, setList] = useState<SchoolInvoice[] | null>(null);
  useEffect(() => {
    fetch('/api/school/fakturor').then((r) => r.json()).then((d) => setList(d.invoices ?? []));
  }, []);
  if (!list || list.length === 0) return null;

  const date = (iso: string) => new Date(iso).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', year: 'numeric', ...tz });
  const month = (p: string) => {
    const [y, m] = p.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString('sv-SE', { month: 'long', year: 'numeric' });
  };
  const status = (i: SchoolInvoice) => {
    if (i.creditOfId) return { label: 'Kreditfaktura', cls: 'bg-gray-100 text-gray-600' };
    if (i.status === 'paid') return { label: 'Betald', cls: 'bg-green-100 text-green-700' };
    if (i.status === 'credited') return { label: 'Krediterad', cls: 'bg-gray-100 text-gray-600' };
    return new Date(i.dueDate) < new Date()
      ? { label: 'Förfallen', cls: 'bg-red-100 text-red-700' }
      : { label: 'Obetald', cls: 'bg-amber-100 text-amber-800' };
  };

  return (
    <div className="bg-white rounded-3xl border border-gray-100 p-5">
      <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
        <FileText className="w-4 h-4 text-gray-400" /> Fakturor
      </h2>
      <ul className="divide-y divide-gray-100">
        {list.map((i) => {
          const s = status(i);
          return (
            <li key={i.id} className="flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-gray-900">{i.creditOfId ? 'Kreditfaktura' : 'Faktura'} {i.number}</span>
                  <span className={clsx('text-[11px] font-bold px-2 py-0.5 rounded-full', s.cls)}>{s.label}</span>
                </div>
                <p className="text-sm text-gray-500 mt-0.5">
                  Kurser i {month(i.period)} · {i.creditOfId || i.status !== 'sent' ? date(i.issueDate) : `betala senast ${date(i.dueDate)}`}
                </p>
              </div>
              <span className="font-bold text-gray-900 shrink-0">{Math.abs(i.total).toLocaleString('sv-SE')} kr</span>
              <a
                href={`/api/school/fakturor/${i.id}/pdf`}
                aria-label={`Ladda ner faktura ${i.number}`}
                className="w-10 h-10 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 flex items-center justify-center shrink-0"
              >
                <Download className="w-4 h-4" />
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
