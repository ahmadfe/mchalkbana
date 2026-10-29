'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { AlarmClock, ChevronRight, ExternalLink, Lock, MapPin, MessageSquare, Plus, Trash2, X } from 'lucide-react';
import clsx from 'clsx';
import AdminShell from '@/components/admin/AdminShell';
import KindBadge from '@/components/admin/KindBadge';
import { Badge, Button, Card, Checkbox, Field, Input, Select, Textarea, formatDate } from '@/components/admin/ui';
import { InvoiceStatus, kr, periodLabel } from '@/components/admin/invoice';
import { ReservationFields, defaultFillBy, newReservation, reservationPayload, useReservationData, type ReservationDraft } from '@/components/admin/Reservations';

interface Student {
  bookingId: number; name: string | null; personnummer: string | null; phone: string | null; email: string | null;
  note: string | null; attendance: string; checkedIn: boolean; invoiced: boolean;
}
interface Course {
  id: number; title: string; type: string; startTime: string; endTime: string; seatLimit: number;
  courseMeetingPlace: string; assigned: boolean;
  allocation: null | { seats: number; meetingPlace: string; fillBy: string | null; message: string; released: boolean };
  students: Student[];
}
interface School { id: number; name: string; email: string; phone: string | null; orgNr: string; billingAddress: string; createdAt: string }
interface Price { courseId: number; title: string; listPrice: number; price: number | null }
interface Invoice { id: number; number: number; period: string; status: string; dueDate: string; issueDate: string; total: number; creditOfId: number | null }
interface Data { school: School; prices: Price[]; invoices: Invoice[]; courses: Course[] }

type Tab = 'kurser' | 'priser' | 'fakturor' | 'uppgifter';

const tz = { timeZone: 'Europe/Stockholm' } as const;
const hm = (iso: string) => new Date(iso).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', ...tz });
const ymd = (iso: string) => new Date(iso).toLocaleDateString('sv-SE', tz);

export default function TrafikskolaPage({ params }: { params: { id: string } }) {
  const locale = useLocale();
  const [data, setData] = useState<Data | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [tab, setTab] = useState<Tab>('kurser');
  const [reserveOpen, setReserveOpen] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/trafikskolor/${params.id}`);
    if (!res.ok) { setNotFound(true); return; }
    setData(await res.json());
  }, [params.id]);
  useEffect(() => { load(); }, [load]);

  const back = { href: '/admin/trafikskolor', label: 'Trafikskolor' };
  if (notFound) return <AdminShell title="Trafikskolan hittades inte" back={back}><p className="text-white/60">Kontot kan ha tagits bort.</p></AdminShell>;
  if (!data) {
    return (
      <AdminShell title="Trafikskola" back={back}>
        <div className="py-20 flex justify-center"><div className="w-6 h-6 border-2 border-white/50 border-t-transparent rounded-full animate-spin" /></div>
      </AdminShell>
    );
  }

  const tabs: [Tab, string][] = [['kurser', 'Kurser'], ['priser', 'Priser'], ['fakturor', `Fakturor (${data.invoices.length})`], ['uppgifter', 'Uppgifter']];

  return (
    <AdminShell
      title={data.school.name}
      back={back}
      actions={<Button variant="primary" onClick={() => setReserveOpen(true)}><Plus className="w-4 h-4" /> <span className="hidden sm:inline">Reservera platser</span></Button>}
    >
      <p className="text-sm text-white/60 -mt-6 mb-6">{[data.school.email, data.school.phone].filter(Boolean).join(' · ')}</p>

      <div className="flex p-1 rounded-2xl bg-[#1c1c1f] mb-5 overflow-x-auto">
        {tabs.map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={clsx('flex-1 min-w-max h-10 px-4 rounded-xl text-sm font-semibold transition', tab === t ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white')}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'kurser' && <Courses schoolId={data.school.id} schoolName={data.school.name} courses={data.courses} reload={load} />}
      {tab === 'priser' && <Prices schoolId={data.school.id} prices={data.prices} reload={load} />}
      {tab === 'fakturor' && <Invoices invoices={data.invoices} locale={locale} />}
      {tab === 'uppgifter' && <Details school={data.school} reload={load} />}

      {reserveOpen && (
        <ReserveSheet
          schoolId={data.school.id}
          takenSessionIds={data.courses.filter(c => c.allocation).map(c => c.id)}
          onClose={() => setReserveOpen(false)}
          onSaved={() => { setReserveOpen(false); setTab('kurser'); load(); }}
        />
      )}
    </AdminShell>
  );
}

// ── Kurser: lista + valt pass, som i skolportalen ─────────────────────

function Courses({ schoolId, schoolName, courses, reload }: { schoolId: number; schoolName: string; courses: Course[]; reload: () => void }) {
  const [view, setView] = useState<'upcoming' | 'archived'>('upcoming');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const now = new Date();
  const upcoming = courses.filter(c => new Date(c.startTime) > now);
  const archived = courses.filter(c => new Date(c.startTime) <= now).reverse();
  const list = view === 'upcoming' ? upcoming : archived;
  const shown = list.find(c => c.id === selectedId) ?? list[0] ?? null;

  const detail = (c: Course) => <CourseDetail key={c.id} schoolId={schoolId} schoolName={schoolName} course={c} readOnly={view === 'archived'} reload={reload} />;

  return (
    <>
      <div className="flex p-1 rounded-xl bg-white/5 mb-4 sm:max-w-sm">
        {([['upcoming', `Kommande (${upcoming.length})`], ['archived', `Arkiverade (${archived.length})`]] as const).map(([v, label]) => (
          <button
            key={v}
            onClick={() => { setView(v); setSelectedId(null); }}
            className={clsx('flex-1 h-9 rounded-lg text-sm font-semibold transition', view === v ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white')}
          >
            {label}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <div className="rounded-3xl bg-[#1c1c1f] p-10 text-center text-white/50">
          {view === 'upcoming' ? 'Inga kommande kurser för skolan. Använd "Reservera platser" för att ge dem platser.' : 'Inga genomförda kurser än.'}
        </div>
      ) : (
        <div className="md:grid md:grid-cols-[minmax(0,300px)_minmax(0,1fr)] lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] md:gap-4 md:items-start">
          <div className="space-y-2">
            {list.map(c => {
              const open = selectedId === c.id;
              const used = c.students.length;
              const seats = c.allocation?.seats;
              return (
                <div key={c.id}>
                  <button
                    onClick={() => setSelectedId(open ? null : c.id)}
                    className={clsx(
                      'w-full text-left flex items-center gap-3 rounded-2xl bg-[#1c1c1f] p-3 sm:p-4 transition border',
                      shown?.id === c.id ? 'md:border-white/30' : 'md:border-transparent',
                      open ? 'border-white/30' : 'border-transparent hover:bg-[#232327]',
                    )}
                  >
                    <div className="w-11 shrink-0 text-center rounded-xl bg-white/5 py-1.5">
                      <p className="text-[11px] uppercase text-white/45 leading-none">{new Date(c.startTime).toLocaleDateString('sv-SE', { month: 'short', ...tz }).replace('.', '')}</p>
                      <p className="font-headline text-lg font-extrabold leading-tight">{new Date(c.startTime).toLocaleDateString('sv-SE', { day: 'numeric', ...tz })}</p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2"><KindBadge type={c.type} /><p className="font-semibold truncate">{c.title}</p></div>
                      <p className="text-sm text-white/50 mt-0.5">{new Date(c.startTime).toLocaleDateString('sv-SE', { weekday: 'short', ...tz })} {hm(c.startTime)}–{hm(c.endTime)}</p>
                      <p className={clsx('text-xs font-semibold mt-1', seats !== undefined && used >= seats ? 'text-emerald-300' : 'text-white/60')}>
                        {seats !== undefined ? `${used} av ${seats} platser fyllda` : `${used} elev${used === 1 ? '' : 'er'}`}
                        {c.allocation?.released && ' · släppta'}
                      </p>
                    </div>
                    <ChevronRight className={clsx('w-4 h-4 text-white/30 shrink-0 transition', open && 'rotate-90 md:rotate-0')} />
                  </button>
                  {open && <div className="md:hidden mt-2">{detail(c)}</div>}
                </div>
              );
            })}
          </div>
          {shown && <div className="hidden md:block">{detail(shown)}</div>}
        </div>
      )}
    </>
  );
}

const ATTENDANCE: Record<string, { label: string; tone: 'green' | 'red' | 'amber' | 'neutral' }> = {
  attended: { label: 'Incheckad', tone: 'green' },
  no_show: { label: 'Uteblev', tone: 'red' },
  late_cancel: { label: 'Sen avbokning', tone: 'amber' },
};

function CourseDetail({ schoolId, schoolName, course: c, readOnly, reload }: { schoolId: number; schoolName: string; course: Course; readOnly: boolean; reload: () => void }) {
  const locale = useLocale();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const a = c.allocation;
  const fillByPassed = !!a?.fillBy && new Date(a.fillBy) < new Date();

  const remove = async (s: Student) => {
    if (!confirm(`Ta bort ${s.name || 'eleven'} från kursen?${s.email ? '\n\nEleven får ett mejl om avbokningen.' : ''}`)) return;
    setError('');
    const res = await fetch(`/api/admin/trafikskolor/${schoolId}/elever/${s.bookingId}`, { method: 'DELETE' });
    if (!res.ok) { setError((await res.json()).error ?? 'Något gick fel'); return; }
    reload();
  };

  return (
    <div className="rounded-3xl bg-[#1c1c1f] p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-headline text-xl font-extrabold">{c.title}</h2>
          <p className="text-sm text-white/60 mt-0.5 capitalize">{new Date(c.startTime).toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long', ...tz })} · {hm(c.startTime)}–{hm(c.endTime)}</p>
        </div>
        <Link href={`/${locale}/admin/kurser/${c.id}`} className="inline-flex items-center gap-1.5 text-sm text-white/60 hover:text-white shrink-0">
          Kurssidan <ExternalLink className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="space-y-1.5 text-sm text-white/75">
        <p className="flex items-start gap-2"><MapPin className="w-4 h-4 text-white/40 shrink-0 mt-0.5" />{a?.meetingPlace || c.courseMeetingPlace}{a?.meetingPlace && <span className="text-white/40">(skolans mötesplats)</span>}</p>
        {a?.fillBy && (
          <p className={clsx('flex items-center gap-2', fillByPassed ? 'text-white/45' : 'text-amber-300')}>
            <AlarmClock className="w-4 h-4 shrink-0" />{fillByPassed ? 'Fyll senast passerat' : 'Fyll senast'} {formatDate(a.fillBy, { day: 'numeric', month: 'long' })}
            {a.released && <Badge>Outnyttjade platser släppta</Badge>}
          </p>
        )}
        {a?.message && <p className="flex items-start gap-2"><MessageSquare className="w-4 h-4 text-white/40 shrink-0 mt-0.5" /><span className="whitespace-pre-wrap">{a.message}</span></p>}
        {!a && c.assigned && <p className="text-white/50">Kursen är tilldelad skolan (utan platskvot).</p>}
        {!a && !c.assigned && <p className="text-white/50">Ingen reservation – skolans elever är bokade direkt på kursen.</p>}
      </div>

      {a && (
        <div>
          <div className="flex justify-between text-xs font-semibold text-white/50 mb-1.5">
            <span>Skolans platser</span><span>{c.students.length} av {a.seats} fyllda</span>
          </div>
          <div className="h-2 rounded-full bg-white/10 overflow-hidden">
            <div className={clsx('h-full rounded-full', c.students.length >= a.seats ? 'bg-emerald-400' : 'bg-sky-400')} style={{ width: `${Math.min(100, (c.students.length / Math.max(1, a.seats)) * 100)}%` }} />
          </div>
        </div>
      )}

      {readOnly ? (
        <p className="flex items-center gap-2 text-sm text-white/45"><Lock className="w-4 h-4" /> Kursen har börjat – ändringar görs på kurssidan.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => setAdding(true)}><Plus className="w-4 h-4" /> Lägg till elev</Button>
          <Button onClick={() => setEditing(true)}>{a ? 'Ändra reservation' : 'Reservera platser'}</Button>
        </div>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}

      <div>
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-white/40 mb-2">Skolans elever ({c.students.length})</p>
        {c.students.length === 0 ? (
          <p className="text-sm text-white/40 py-3 text-center">Inga elever än.</p>
        ) : (
          <ul className="space-y-2">
            {c.students.map(s => {
              const att = ATTENDANCE[s.attendance] ?? (s.checkedIn ? ATTENDANCE.attended : null);
              return (
                <li key={s.bookingId} className="rounded-2xl bg-white/5 px-4 py-3 flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold">{s.name || '–'}</p>
                      {att && <Badge tone={att.tone}>{att.label}</Badge>}
                      {s.invoiced && <Badge>Fakturerad</Badge>}
                    </div>
                    <p className="text-sm font-mono text-white/60">{s.personnummer || '–'}</p>
                    {(s.phone || s.email?.includes('@')) && (
                      <p className="text-xs text-white/45 mt-0.5 break-all">{[s.phone, s.email?.includes('@') ? s.email : null].filter(Boolean).join(' · ')}</p>
                    )}
                    {s.note && <p className="text-xs text-amber-200 bg-amber-500/10 rounded-lg px-2.5 py-1.5 mt-2 whitespace-pre-wrap">📝 {s.note}</p>}
                  </div>
                  {!readOnly && !s.invoiced && (
                    <button onClick={() => remove(s)} aria-label={`Ta bort ${s.name || 'eleven'}`} className="w-10 h-10 -mr-2 rounded-full text-white/40 hover:text-red-400 hover:bg-red-500/10 flex items-center justify-center shrink-0">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {adding && <AddStudentSheet schoolId={schoolId} schoolName={schoolName} course={c} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); reload(); }} />}
      {editing && <EditReservationSheet schoolId={schoolId} course={c} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); reload(); }} />}
    </div>
  );
}

function Sheet({ title, sub, onClose, children }: { title: string; sub?: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={e => e.stopPropagation()}
        className="sheet bg-[#1c1c1f] text-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-lg max-h-[92dvh] overflow-y-auto p-5 sm:p-6 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-6"
      >
        <div className="flex items-start justify-between gap-3 mb-5 pt-2 sm:pt-0">
          <div className="min-w-0">
            <h3 className="font-headline text-xl font-extrabold">{title}</h3>
            {sub && <p className="text-sm text-white/50 mt-0.5">{sub}</p>}
          </div>
          <button onClick={onClose} aria-label="Stäng" className="w-10 h-10 -mr-2 rounded-full hover:bg-white/10 flex items-center justify-center shrink-0"><X className="w-5 h-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function AddStudentSheet({ schoolId, schoolName, course: c, onClose, onSaved }: { schoolId: number; schoolName: string; course: Course; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ guestName: '', personnummer: '', guestPhone: '', guestEmail: '', note: '', sendConfirmation: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  const save = async () => {
    setBusy(true);
    setError('');
    const res = await fetch(`/api/admin/trafikskolor/${schoolId}/elever`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...f, sessionId: c.id }),
    });
    setBusy(false);
    if (!res.ok) { setError((await res.json()).error ?? 'Något gick fel'); return; }
    onSaved();
  };

  return (
    <Sheet title="Lägg till elev" sub={`${schoolName} · ${c.title}, ${formatDate(c.startTime, { day: 'numeric', month: 'short' })}`} onClose={onClose}>
      <div className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Namn" required><Input value={f.guestName} onChange={set('guestName')} placeholder="Anna Svensson" autoComplete="off" /></Field>
          <Field label="Personnummer" required><Input value={f.personnummer} onChange={set('personnummer')} placeholder="ÅÅÅÅMMDD-XXXX" inputMode="numeric" autoComplete="off" /></Field>
          <Field label="Telefon"><Input type="tel" value={f.guestPhone} onChange={set('guestPhone')} /></Field>
          <Field label="E-post"><Input type="email" value={f.guestEmail} onChange={set('guestEmail')} /></Field>
        </div>
        <Field label="Anteckning"><Textarea value={f.note} onChange={set('note')} placeholder="Syns för skolan, t.ex. behöver tolk" /></Field>
        {f.guestEmail && <Checkbox checked={f.sendConfirmation} onChange={v => setF({ ...f, sendConfirmation: v })}>Skicka bokningsbekräftelse till eleven</Checkbox>}
        <p className="text-xs text-white/40">Eleven bokas på skolans platser och faktureras skolan.</p>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="flex gap-3">
          <Button onClick={onClose}>Avbryt</Button>
          <Button variant="primary" className="flex-1" disabled={busy || !f.guestName.trim() || !f.personnummer.trim()} onClick={save}>{busy ? 'Sparar…' : 'Lägg till'}</Button>
        </div>
      </div>
    </Sheet>
  );
}

function EditReservationSheet({ schoolId, course: c, onClose, onSaved }: { schoolId: number; course: Course; onClose: () => void; onSaved: () => void }) {
  const { schools, places, addSchool } = useReservationData();
  const a = c.allocation;
  const [r, setR] = useState<ReservationDraft>(() => ({
    ...newReservation(ymd(c.startTime)),
    schoolUserId: String(schoolId),
    ...(a ? { seats: String(a.seats), fillBy: a.fillBy ? ymd(a.fillBy) : '', fillByAuto: false, meetingPlace: a.meetingPlace, message: a.message } : {}),
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    setBusy(true);
    setError('');
    const res = await fetch(`/api/admin/kurser/${c.id}/reservationer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reservationPayload(r)),
    });
    setBusy(false);
    if (!res.ok) { setError((await res.json()).error ?? 'Något gick fel'); return; }
    onSaved();
  };

  const removeAll = async () => {
    if (!confirm('Ta bort reservationen? Platserna blir lediga för andra.')) return;
    setBusy(true);
    const res = await fetch(`/api/admin/kurser/${c.id}/reservationer?schoolUserId=${schoolId}`, { method: 'DELETE' });
    setBusy(false);
    if (!res.ok) { setError((await res.json()).error ?? 'Något gick fel'); return; }
    onSaved();
  };

  return (
    <Sheet title={a ? 'Ändra reservation' : 'Reservera platser'} sub={`${c.title}, ${formatDate(c.startTime, { day: 'numeric', month: 'short' })}`} onClose={onClose}>
      <div className="space-y-4">
        <ReservationFields value={r} onChange={setR} schools={schools} places={places} onSchoolCreated={addSchool} lockSchool />
        {a?.released && <p className="text-sm text-amber-300">Ett nytt &quot;fyll senast&quot;-datum framåt i tiden öppnar platserna igen.</p>}
        <p className="text-xs text-white/40">Skolan får ett mejl om den får fler platser.</p>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="flex flex-wrap gap-3">
          <Button onClick={onClose}>Avbryt</Button>
          <Button variant="primary" className="flex-1" disabled={busy} onClick={save}>{busy ? 'Sparar…' : 'Spara'}</Button>
        </div>
        {a && c.students.length === 0 && (
          <button onClick={removeAll} disabled={busy} className="text-sm text-red-400 hover:text-red-300">Ta bort reservationen</button>
        )}
      </div>
    </Sheet>
  );
}

/** Reservera platser åt skolan på en kommande kurs. */
function ReserveSheet({ schoolId, takenSessionIds, onClose, onSaved }: { schoolId: number; takenSessionIds: number[]; onClose: () => void; onSaved: () => void }) {
  const { schools, places, addSchool } = useReservationData();
  const [sessions, setSessions] = useState<{ id: number; startTime: string; title: string; seatLimit: number; booked: number; status: string }[] | null>(null);
  const [sessionId, setSessionId] = useState('');
  const [r, setR] = useState<ReservationDraft>(() => ({ ...newReservation(new Date().toLocaleDateString('sv-SE', tz)), schoolUserId: String(schoolId) }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/admin/kurser?view=upcoming').then(res => res.json()).then(d => setSessions((d.kurser ?? []).filter((k: { status: string }) => k.status !== 'canceled')));
  }, []);

  const pick = (id: string) => {
    setSessionId(id);
    const s = sessions?.find(x => String(x.id) === id);
    if (s && r.fillByAuto) setR({ ...r, fillBy: defaultFillBy(ymd(s.startTime)) });
  };

  const save = async () => {
    setBusy(true);
    setError('');
    const res = await fetch(`/api/admin/kurser/${sessionId}/reservationer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reservationPayload(r)),
    });
    setBusy(false);
    if (!res.ok) { setError((await res.json()).error ?? 'Något gick fel'); return; }
    onSaved();
  };

  return (
    <Sheet title="Reservera platser" sub="Skolan får ett mejl och kan lägga till sina elever i skolportalen." onClose={onClose}>
      <div className="space-y-4">
        <Field label="Kurs" required>
          <Select value={sessionId} onChange={e => pick(e.target.value)}>
            <option value="">{sessions ? 'Välj kurs' : 'Laddar…'}</option>
            {sessions?.map(s => (
              <option key={s.id} value={s.id} disabled={takenSessionIds.includes(s.id)}>
                {formatDate(s.startTime, { weekday: 'short', day: 'numeric', month: 'short' })} {hm(s.startTime)} · {s.title} ({s.booked}/{s.seatLimit}){takenSessionIds.includes(s.id) ? ' – redan reserverad' : ''}
              </option>
            ))}
          </Select>
        </Field>
        <ReservationFields value={r} onChange={setR} schools={schools} places={places} onSchoolCreated={addSchool} lockSchool />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="flex gap-3">
          <Button onClick={onClose}>Avbryt</Button>
          <Button variant="primary" className="flex-1" disabled={busy || !sessionId} onClick={save}>{busy ? 'Sparar…' : 'Reservera'}</Button>
        </div>
      </div>
    </Sheet>
  );
}

// ── Priser, fakturor och uppgifter ───────────────────────────────────

function Prices({ schoolId, prices, reload }: { schoolId: number; prices: Price[]; reload: () => void }) {
  const [values, setValues] = useState<Record<number, string>>(() => Object.fromEntries(prices.map(p => [p.courseId, p.price === null ? '' : String(p.price)])));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const save = async () => {
    setBusy(true);
    setMsg('');
    const list = Object.entries(values).filter(([, v]) => v.trim() !== '').map(([courseId, v]) => ({ courseId: Number(courseId), price: Number(v) }));
    if (list.some(p => !Number.isInteger(p.price) || p.price < 0)) { setBusy(false); setMsg('Priserna ska vara hela kronor'); return; }
    const res = await fetch(`/api/admin/school-accounts/${schoolId}/prices`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prices: list }),
    });
    setBusy(false);
    setMsg(res.ok ? 'Sparat' : 'Något gick fel');
    if (res.ok) reload();
  };

  return (
    <Card title="Skolans priser">
      <p className="text-sm text-white/60 mb-4">Priset per elev som skolan faktureras. Lämna tomt för ordinarie pris.</p>
      <div className="space-y-3">
        {prices.map(p => (
          <div key={p.courseId} className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-semibold truncate">{p.title}</p>
              <p className="text-xs text-white/45">Ordinarie {kr(p.listPrice)}</p>
            </div>
            <div className="w-32 shrink-0">
              <Input type="number" min={0} inputMode="numeric" placeholder={String(p.listPrice)} value={values[p.courseId] ?? ''} onChange={e => setValues({ ...values, [p.courseId]: e.target.value })} />
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3 mt-5">
        <Button variant="primary" disabled={busy} onClick={save}>{busy ? 'Sparar…' : 'Spara priser'}</Button>
        {msg && <span className={clsx('text-sm', msg === 'Sparat' ? 'text-emerald-300' : 'text-red-400')}>{msg}</span>}
      </div>
    </Card>
  );
}

function Invoices({ invoices, locale }: { invoices: Invoice[]; locale: string }) {
  if (invoices.length === 0) {
    return <div className="rounded-3xl bg-[#1c1c1f] p-10 text-center text-white/50">Inga fakturor än. Skolans elever faktureras under <Link href={`/${locale}/admin/fakturor`} className="underline">Fakturor</Link>.</div>;
  }
  return (
    <div className="space-y-2">
      {invoices.map(i => (
        <Link key={i.id} href={`/${locale}/admin/fakturor/${i.id}`} className="flex items-center gap-4 rounded-2xl bg-[#1c1c1f] hover:bg-[#232327] px-5 py-4 transition">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold">#{i.number}</span>
              <InvoiceStatus inv={i} />
            </div>
            <p className="text-sm text-white/50 mt-0.5">{periodLabel(i.period)} · {i.status === 'sent' && !i.creditOfId ? `förfaller ${formatDate(i.dueDate)}` : formatDate(i.issueDate)}</p>
          </div>
          <span className="font-headline font-extrabold shrink-0">{kr(i.total)}</span>
          <ChevronRight className="w-4 h-4 text-white/30 shrink-0" />
        </Link>
      ))}
    </div>
  );
}

function Details({ school, reload }: { school: School; reload: () => void }) {
  const locale = useLocale();
  const [f, setF] = useState({ phone: school.phone ?? '', orgNr: school.orgNr, billingAddress: school.billingAddress });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const save = async () => {
    setBusy(true);
    setMsg('');
    const res = await fetch(`/api/admin/trafikskolor/${school.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(f),
    });
    setBusy(false);
    setMsg(res.ok ? 'Sparat' : 'Något gick fel');
    if (res.ok) reload();
  };

  return (
    <div className="grid lg:grid-cols-2 gap-4 items-start">
      <Card title="Kontakt och fakturering">
        <div className="space-y-4">
          <Field label="E-post (inloggning)" hint="E-post och lösenord ändras under Personal."><Input value={school.email} disabled /></Field>
          <Field label="Telefon"><Input type="tel" value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} /></Field>
          <Field label="Organisationsnummer"><Input value={f.orgNr} onChange={e => setF({ ...f, orgNr: e.target.value })} placeholder="556677-8899" /></Field>
          <Field label="Fakturaadress"><Textarea value={f.billingAddress} onChange={e => setF({ ...f, billingAddress: e.target.value })} placeholder={'Gatan 1\n123 45 Ort'} /></Field>
          <div className="flex items-center gap-3">
            <Button variant="primary" disabled={busy} onClick={save}>{busy ? 'Sparar…' : 'Spara'}</Button>
            {msg && <span className={clsx('text-sm', msg === 'Sparat' ? 'text-emerald-300' : 'text-red-400')}>{msg}</span>}
          </div>
        </div>
      </Card>
      <Card title="Konto">
        <p className="text-sm text-white/60">Kund sedan {formatDate(school.createdAt)}.</p>
        <p className="text-sm text-white/60 mt-2">Lösenord, e-post och inaktivering hanteras under <Link href={`/${locale}/admin/personal?tab=school`} className="underline">Personal</Link>.</p>
      </Card>
    </div>
  );
}
