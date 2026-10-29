'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { AlertTriangle, CheckCircle2, ChevronLeft, ContactRound, MessageSquare, Phone, School, Search, Send, UserPlus, X, XCircle } from 'lucide-react';
import clsx from 'clsx';
import InstructorShell from '@/components/InstructorShell';
import KindBadge from '@/components/admin/KindBadge';
import CheckInModal from '@/components/CheckInModal';
import { useAuth } from '@/context/AuthContext';
import { normalizePersonnummer } from '@/lib/pnr';

interface Student {
  id: number;
  guestName: string | null;
  personnummer: string | null;
  guestPhone: string | null;
  guestEmail: string | null;
  result: string | null;
  resultNote: string | null;
  bookedByRole: string;
  checkedInAt: string | null;
  idType: string | null;
  note: string | null;
  bookedBySchoolUserId: number | null;
  schoolName: string | null;
  schoolLocked: string | null;
  user: { name: string; phone: string | null; email: string } | null;
}
interface SessionDetail {
  id: number; startTime: string; endTime: string; resultsSentAt: string | null;
  course: { titleSv: string; type: string; behorighet: string };
  bookings: Student[];
}
interface SchoolOption { id: number; name: string }

const ID_LABEL: Record<string, string> = { korkort: 'Körkort', pass: 'Pass', nationellt_id: 'Nationellt id-kort', id_kort: 'Id-kort' };
const tz = { timeZone: 'Europe/Stockholm' } as const;
const hm = (iso: string) => new Date(iso).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', ...tz });
const nameOf = (s: Student) => s.guestName || s.user?.name || '–';

export default function InstruktorSessionPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const locale = useLocale();
  const { user } = useAuth();
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [q, setQ] = useState('');
  const [saving, setSaving] = useState<number | null>(null);
  const [checkInFor, setCheckInFor] = useState<Student | null>(null);
  const [schoolFor, setSchoolFor] = useState<Student | null>(null);
  const [noteFor, setNoteFor] = useState<Student | null>(null);
  const [adding, setAdding] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');

  const reload = useCallback(async () => {
    const res = await fetch(`/api/instructor/sessions/${id}`);
    if (!res.ok) { setNotFound(true); return; }
    const d = await res.json();
    setSession(d.session);
    setSchools(d.schools ?? []);
  }, [id]);
  useEffect(() => { if (user?.role === 'instructor') reload(); }, [user, reload]);

  // Bedömning och notering sparas var för sig – då kan de aldrig skriva över varandra
  const patchStudent = async (bookingId: number, data: { result?: string | null; resultNote?: string }) => {
    setSaving(bookingId);
    const res = await fetch(`/api/instructor/bookings/${bookingId}/result`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const { booking } = await res.json();
      setSession(prev => prev && { ...prev, bookings: prev.bookings.map(b => b.id === bookingId ? { ...b, result: booking.result, resultNote: booking.resultNote } : b) });
    }
    setSaving(null);
  };

  const send = async () => {
    if (!session) return;
    const notIn = session.bookings.filter(b => !b.checkedInAt).length;
    const notAssessed = session.bookings.filter(b => !b.result).length;
    const warn = [notIn && `${notIn} är inte incheckad${notIn === 1 ? '' : 'e'}`, notAssessed && `${notAssessed} är inte bedömd${notAssessed === 1 ? '' : 'a'}`].filter(Boolean).join(' och ');
    if (!confirm(warn ? `${warn[0].toUpperCase()}${warn.slice(1)}. Skicka ändå?` : 'Skicka resultaten för kursen?')) return;
    setSending(true);
    setSendError('');
    const res = await fetch(`/api/instructor/sessions/${id}/approve`, { method: 'POST' });
    setSending(false);
    if (!res.ok) { setSendError('Kunde inte skicka. Försök igen.'); return; }
    reload();
  };

  if (notFound) {
    return (
      <InstructorShell>
        <BackLink locale={locale} />
        <p className="text-white/60">Kursen hittades inte eller är inte din.</p>
      </InstructorShell>
    );
  }
  if (!session) {
    return <InstructorShell><div className="py-16 flex justify-center"><div className="w-6 h-6 border-2 border-white/50 border-t-transparent rounded-full animate-spin" /></div></InstructorShell>;
  }

  const total = session.bookings.length;
  const passed = session.bookings.filter(b => b.result === 'passed').length;
  const failed = session.bookings.filter(b => b.result === 'failed').length;
  const checkedIn = session.bookings.filter(b => b.checkedInAt).length;
  const query = q.trim().toLowerCase().replace(/-/g, '');
  const shown = query
    ? session.bookings.filter(b => `${nameOf(b)} ${b.personnummer ?? ''}`.toLowerCase().replace(/-/g, '').includes(query))
    : session.bookings;

  return (
    <InstructorShell>
      <BackLink locale={locale} />
      <div className="flex items-center gap-2"><KindBadge type={session.course.type} /><span className="text-xs text-white/50">{session.course.behorighet}</span></div>
      <h1 className="font-headline text-2xl sm:text-3xl font-extrabold tracking-tight mt-1.5">{session.course.titleSv}</h1>
      <p className="text-white/60 mt-1 capitalize">
        {new Date(session.startTime).toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long', ...tz })} · {hm(session.startTime)}–{hm(session.endTime)}
      </p>

      <div className="grid grid-cols-4 gap-2 sm:gap-3 mt-5">
        <Stat label="Incheckade" value={`${checkedIn}/${total}`} />
        <Stat label="Godkända" value={passed} tone="green" />
        <Stat label="Underkända" value={failed} tone="red" />
        <Stat label="Ej bedömda" value={total - passed - failed} tone={total - passed - failed > 0 ? 'amber' : undefined} />
      </div>

      {session.resultsSentAt && (
        <p className="flex items-center gap-2 text-sm text-emerald-300 bg-emerald-500/10 rounded-2xl px-4 py-3 mt-4">
          <CheckCircle2 className="w-4 h-4 shrink-0" /> Resultat skickat {hm(session.resultsSentAt)}. Ändrar du något – skicka igen.
        </p>
      )}

      {total > 4 && (
        <div className="relative mt-5">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Sök namn eller personnummer"
            className="w-full h-12 pl-11 pr-4 rounded-2xl bg-[#1c1c1f] border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-white/40"
          />
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-3 mt-4">
        {shown.map(s => (
          <StudentCard
            key={s.id}
            s={s}
            saving={saving === s.id}
            onCheckIn={() => setCheckInFor(s)}
            onSchool={() => setSchoolFor(s)}
            onNote={() => setNoteFor(s)}
            onResult={r => patchStudent(s.id, { result: s.result === r ? null : r })}
          />
        ))}
        {total === 0 && <div className="rounded-3xl bg-[#1c1c1f] p-8 text-center text-white/50 md:col-span-2">Inga elever bokade på kursen.</div>}
        {total > 0 && shown.length === 0 && <div className="rounded-3xl bg-[#1c1c1f] p-8 text-center text-white/50 md:col-span-2">Ingen elev matchar sökningen.</div>}
      </div>

      <button
        onClick={() => setAdding(true)}
        className="w-full mt-3 h-14 rounded-2xl border-2 border-dashed border-white/15 text-white/60 hover:text-white hover:border-white/30 font-semibold flex items-center justify-center gap-2"
      >
        <UserPlus className="w-5 h-5" /> Lägg till elev som saknas på listan
      </button>

      {/* Skicka resultaten – alltid nära till hands */}
      <div className="fixed inset-x-0 bottom-0 z-20 bg-[#0b0b0d]/95 backdrop-blur border-t border-white/10 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <div className="max-w-5xl mx-auto sm:px-2">
          {sendError && <p className="text-sm text-red-400 mb-2">{sendError}</p>}
          <button
            onClick={send}
            disabled={sending || total === 0}
            className={clsx(
              'w-full h-14 rounded-2xl font-bold text-base flex items-center justify-center gap-2 active:scale-[0.99] disabled:opacity-50',
              session.resultsSentAt ? 'bg-white/10 text-white border border-white/10' : 'bg-white text-black',
            )}
          >
            <Send className="w-5 h-5" />
            {sending ? 'Skickar…' : session.resultsSentAt ? 'Skicka resultaten igen' : 'Godkänn & skicka resultat'}
          </button>
        </div>
      </div>

      {checkInFor && (
        <CheckInModal
          person={{
            bookingId: checkInFor.id,
            name: nameOf(checkInFor),
            email: checkInFor.guestEmail || checkInFor.user?.email,
            phone: checkInFor.guestPhone || checkInFor.user?.phone,
            personnummer: checkInFor.personnummer,
            behorighet: session.course.behorighet,
          }}
          school={{ schools, current: checkInFor.bookedBySchoolUserId, currentName: checkInFor.schoolName, locked: checkInFor.schoolLocked }}
          onClose={() => setCheckInFor(null)}
          onDone={() => { setCheckInFor(null); reload(); }}
        />
      )}
      {schoolFor && <SchoolSheet student={schoolFor} schools={schools} onClose={() => setSchoolFor(null)} onSaved={() => { setSchoolFor(null); reload(); }} />}
      {noteFor && (
        <NoteSheet
          student={noteFor}
          onClose={() => setNoteFor(null)}
          onSave={async note => { await patchStudent(noteFor.id, { resultNote: note }); setNoteFor(null); }}
        />
      )}
      {adding && <AddSheet sessionId={session.id} onClose={() => setAdding(false)} onSaved={info => { setAdding(false); if (info) alert(info); reload(); }} />}
    </InstructorShell>
  );
}

function BackLink({ locale }: { locale: string }) {
  return (
    <Link href={`/${locale}/instruktor`} className="inline-flex items-center gap-1 h-10 -mt-2 mb-1 text-sm text-white/60 hover:text-white">
      <ChevronLeft className="w-4 h-4" /> Idag
    </Link>
  );
}

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: 'green' | 'red' | 'amber' }) {
  return (
    <div className="rounded-2xl bg-[#1c1c1f] px-2 py-3 text-center">
      <p className={clsx('font-headline text-xl sm:text-2xl font-extrabold', tone === 'green' ? 'text-emerald-300' : tone === 'red' ? 'text-red-300' : tone === 'amber' ? 'text-amber-300' : 'text-white')}>{value}</p>
      <p className="text-[11px] sm:text-xs text-white/50 mt-0.5">{label}</p>
    </div>
  );
}

function StudentCard({ s, saving, onCheckIn, onSchool, onNote, onResult }: {
  s: Student; saving: boolean;
  onCheckIn: () => void; onSchool: () => void; onNote: () => void; onResult: (r: 'passed' | 'failed') => void;
}) {
  const phone = s.guestPhone || s.user?.phone || null;
  return (
    <div className={clsx(
      'rounded-3xl bg-[#1c1c1f] overflow-hidden border',
      s.result === 'passed' ? 'border-emerald-500/40' : s.result === 'failed' ? 'border-red-500/40' : 'border-transparent',
    )}>
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-bold text-lg leading-tight">{nameOf(s)}</p>
            <p className="font-mono text-sm text-white/60 mt-0.5">{s.personnummer || 'Personnummer saknas'}</p>
          </div>
          {saving && <div className="w-4 h-4 border-2 border-white/60 border-t-transparent rounded-full animate-spin shrink-0 mt-1" />}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2 text-sm">
          <button onClick={onSchool} className={clsx('inline-flex items-center gap-1.5 font-semibold', s.schoolName ? 'text-sky-300' : 'text-white/50')}>
            <School className="w-4 h-4" /> {s.schoolName ?? 'Privat'}
          </button>
          {phone && <a href={`tel:${phone}`} className="inline-flex items-center gap-1.5 text-white/60"><Phone className="w-4 h-4" /> {phone}</a>}
        </div>
        {s.note && <p className="text-sm text-amber-200 bg-amber-500/10 rounded-xl px-3 py-2 mt-2 whitespace-pre-wrap">📝 {s.note}</p>}
      </div>

      {s.checkedInAt ? (
        <p className="flex items-center gap-2 px-4 py-3 border-t border-white/5 text-sm text-emerald-300">
          <CheckCircle2 className="w-4 h-4 shrink-0" /> Incheckad {hm(s.checkedInAt)}{s.idType ? ` · ${ID_LABEL[s.idType] ?? s.idType}` : ''}
        </p>
      ) : (
        <button onClick={onCheckIn} className="w-full h-14 flex items-center justify-center gap-2 border-t border-white/5 font-bold text-amber-300 hover:bg-amber-500/10 active:bg-amber-500/15">
          <ContactRound className="w-5 h-5" /> Checka in – kontrollera legitimation
        </button>
      )}

      <div className="grid grid-cols-2 border-t border-white/5">
        <button
          onClick={() => onResult('passed')}
          disabled={saving}
          className={clsx('h-14 flex items-center justify-center gap-2 font-bold border-r border-white/5 transition', s.result === 'passed' ? 'bg-emerald-600 text-white' : 'text-emerald-300 hover:bg-emerald-500/10')}
        >
          <CheckCircle2 className="w-5 h-5" /> Godkänd
        </button>
        <button
          onClick={() => onResult('failed')}
          disabled={saving}
          className={clsx('h-14 flex items-center justify-center gap-2 font-bold transition', s.result === 'failed' ? 'bg-red-600 text-white' : 'text-red-300 hover:bg-red-500/10')}
        >
          <XCircle className="w-5 h-5" /> Underkänd
        </button>
      </div>

      <button onClick={onNote} className="w-full text-left px-4 py-3 border-t border-white/5 text-sm flex items-center gap-2 text-white/50 hover:text-white">
        <MessageSquare className="w-4 h-4 shrink-0" />
        {s.resultNote ? <span className="text-white/80 truncate">{s.resultNote}</span> : 'Lägg till notering'}
      </button>
    </div>
  );
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={e => e.stopPropagation()}
        className="sheet bg-[#1c1c1f] text-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md max-h-[92dvh] overflow-y-auto p-5 sm:p-6 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-6"
      >
        <div className="flex items-start justify-between gap-3 mb-5 pt-2 sm:pt-0">
          <h3 className="font-headline text-xl font-extrabold">{title}</h3>
          <button onClick={onClose} aria-label="Stäng" className="w-10 h-10 -mr-2 rounded-full hover:bg-white/10 flex items-center justify-center shrink-0"><X className="w-5 h-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

const field = 'w-full h-14 px-4 rounded-2xl bg-[#26262a] border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-white/40';

/** Byt skola efteråt, t.ex. om fel skola valdes vid incheckningen. */
function SchoolSheet({ student, schools, onClose, onSaved }: { student: Student; schools: SchoolOption[]; onClose: () => void; onSaved: () => void }) {
  const [value, setValue] = useState(student.bookedBySchoolUserId ? String(student.bookedBySchoolUserId) : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const save = async () => {
    setBusy(true);
    setError('');
    const res = await fetch(`/api/checkin/${student.id}/school`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schoolUserId: value ? Number(value) : null }),
    });
    setBusy(false);
    if (!res.ok) { setError((await res.json()).error ?? 'Något gick fel'); return; }
    onSaved();
  };
  return (
    <Sheet title="Trafikskola" onClose={onClose}>
      <p className="text-sm text-white/60 mb-4">Vilken trafikskola kommer {nameOf(student)} från? Skolan faktureras för eleven.</p>
      {student.schoolLocked ? (
        <p className="flex items-start gap-2 rounded-2xl border border-white/10 px-4 py-3 text-sm">
          <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" /> {student.schoolName ?? 'Privat'} – {student.schoolLocked}.
        </p>
      ) : (
        <>
          <select value={value} onChange={e => setValue(e.target.value)} className={clsx(field, 'font-semibold [color-scheme:dark]')}>
            <option value="">Ingen – privat (betalar själv)</option>
            {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          {error && <p className="text-sm text-red-400 mt-3">{error}</p>}
          <div className="flex gap-3 mt-5">
            <button onClick={onClose} className="h-12 px-6 rounded-full bg-white/10 font-bold">Avbryt</button>
            <button onClick={save} disabled={busy} className="flex-1 h-12 rounded-full bg-white text-black font-bold disabled:opacity-50">{busy ? 'Sparar…' : 'Spara'}</button>
          </div>
        </>
      )}
    </Sheet>
  );
}

function NoteSheet({ student, onClose, onSave }: { student: Student; onClose: () => void; onSave: (note: string) => Promise<void> }) {
  const [note, setNote] = useState(student.resultNote ?? '');
  const [busy, setBusy] = useState(false);
  return (
    <Sheet title="Notering" onClose={onClose}>
      <p className="text-sm text-white/60 mb-3">{nameOf(student)}</p>
      <textarea
        value={note}
        onChange={e => setNote(e.target.value)}
        autoFocus
        rows={4}
        placeholder="T.ex. behöver öva mer på halt underlag"
        className="w-full px-4 py-3 rounded-2xl bg-[#26262a] border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-white/40"
      />
      <div className="flex gap-3 mt-4">
        <button onClick={onClose} className="h-12 px-6 rounded-full bg-white/10 font-bold">Avbryt</button>
        <button onClick={async () => { setBusy(true); await onSave(note.trim()); setBusy(false); }} disabled={busy} className="flex-1 h-12 rounded-full bg-white text-black font-bold disabled:opacity-50">{busy ? 'Sparar…' : 'Spara'}</button>
      </div>
    </Sheet>
  );
}

interface StudentHit { id: number; name: string; personnummer: string; phone: string; email: string }
interface NewStudent { firstName: string; lastName: string; personnummer: string; phone: string; email: string }

/** Lägger det man sökte på i rätt fält: e-post, personnummer, telefon eller namn (som på adminsidan). */
function prefillFromQuery(raw: string): NewStudent {
  const q = raw.trim();
  const empty: NewStudent = { firstName: '', lastName: '', personnummer: '', phone: '', email: '' };
  if (!q) return empty;
  if (q.includes('@')) return { ...empty, email: q };
  if (/^[\d\s+-]+$/.test(q)) {
    const looksLikePnr = /^\d{6}(\d{2})?[-+]\d{4}$/.test(q) || (!!normalizePersonnummer(q) && !q.startsWith('0') && !q.startsWith('+'));
    return looksLikePnr ? { ...empty, personnummer: q } : { ...empty, phone: q };
  }
  const [first, ...rest] = q.split(/\s+/);
  return { ...empty, firstName: first, lastName: rest.join(' ') };
}

/** Elev som saknas på listan: sök i elevregistret, eller skapa en ny elev. Skolan väljs sedan vid incheckningen. */
function AddSheet({ sessionId, onClose, onSaved }: { sessionId: number; onClose: () => void; onSaved: (info?: string) => void }) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<StudentHit[]>([]);
  const [searched, setSearched] = useState(false);
  const [picked, setPicked] = useState<StudentHit | null>(null);
  const [creating, setCreating] = useState<NewStudent | null>(null);
  const [sendConfirmation, setSendConfirmation] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setSearched(false);
    if (picked || creating || q.trim().length < 2) { setHits([]); return; }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/instructor/sessions/${sessionId}/students?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        .then(r => r.json()).then(d => { setHits(d.students ?? []); setSearched(true); }).catch(() => {});
    }, 250);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [q, picked, creating, sessionId]);

  const email = picked?.email || creating?.email || '';
  const canSubmit = picked ? true : !!creating && !!creating.firstName.trim() && !!creating.lastName.trim() && !!creating.personnummer.trim();

  const save = async () => {
    setBusy(true);
    setError('');
    const res = await fetch(`/api/instructor/sessions/${sessionId}/students`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...(picked ? { studentId: picked.id } : creating), sendConfirmation: sendConfirmation && !!email }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) { setError(data.error ?? 'Något gick fel'); return; }
    onSaved(data.existed ? 'Personnumret fanns redan i elevregistret – den sparade eleven lades till.' : undefined);
  };

  return (
    <Sheet title={creating ? 'Ny elev' : 'Lägg till elev'} onClose={onClose}>
      <div className="space-y-3">
        {picked ? (
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-[#26262a] border border-white/10 px-4 py-3">
            <div className="min-w-0">
              <p className="font-semibold truncate">{picked.name}</p>
              <p className="text-sm text-white/50 truncate">{[picked.personnummer, picked.phone].filter(Boolean).join(' · ')}</p>
            </div>
            <button onClick={() => setPicked(null)} className="text-sm text-white/60 hover:text-white shrink-0">Byt</button>
          </div>
        ) : creating ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <input className={field} placeholder="Förnamn *" value={creating.firstName} onChange={e => setCreating({ ...creating, firstName: e.target.value })} autoComplete="off" autoFocus />
              <input className={field} placeholder="Efternamn *" value={creating.lastName} onChange={e => setCreating({ ...creating, lastName: e.target.value })} autoComplete="off" />
            </div>
            <input className={clsx(field, 'font-mono')} placeholder="Personnummer * (ÅÅÅÅMMDD-XXXX)" inputMode="numeric" value={creating.personnummer} onChange={e => setCreating({ ...creating, personnummer: e.target.value })} autoComplete="off" />
            <div className="grid grid-cols-2 gap-3">
              <input className={field} placeholder="Telefon" type="tel" value={creating.phone} onChange={e => setCreating({ ...creating, phone: e.target.value })} />
              <input className={field} placeholder="E-post" type="email" value={creating.email} onChange={e => setCreating({ ...creating, email: e.target.value })} />
            </div>
            <p className="text-xs text-white/50">Eleven sparas i elevregistret och läggs till på kursen. Välj elevens trafikskola när du checkar in eleven.</p>
            <button onClick={() => { setCreating(null); setError(''); }} className="text-sm text-white/60 hover:text-white">← Tillbaka till sökning</button>
          </>
        ) : (
          <>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                className={clsx(field, 'pl-11')}
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="Sök elev – namn, personnummer, telefon"
                autoFocus
                autoComplete="off"
              />
            </div>
            {hits.length > 0 && (
              <div className="rounded-2xl bg-[#26262a] border border-white/10 overflow-hidden">
                {hits.map(h => (
                  <button key={h.id} onClick={() => { setPicked(h); setHits([]); }} className="w-full text-left px-4 py-3 hover:bg-white/5 border-b border-white/5 last:border-0">
                    <p className="font-semibold">{h.name}</p>
                    <p className="text-sm text-white/50">{[h.personnummer, h.phone].filter(Boolean).join(' · ')}</p>
                  </button>
                ))}
              </div>
            )}
            {searched && hits.length === 0 && <p className="text-sm text-white/60 px-1">Ingen elev hittades för &quot;{q.trim()}&quot;.</p>}
            <button
              onClick={() => { setError(''); setCreating(prefillFromQuery(q)); }}
              className="w-full h-12 rounded-2xl border border-dashed border-white/20 text-white/70 hover:text-white hover:border-white/40 font-semibold"
            >
              + Skapa ny elev
            </button>
          </>
        )}

        {(picked || creating) && email && (
          <label className="flex items-center gap-3 cursor-pointer select-none pt-1">
            <input type="checkbox" checked={sendConfirmation} onChange={e => setSendConfirmation(e.target.checked)} className="w-6 h-6 rounded accent-white" />
            <span className="text-[15px]">Skicka bokningsbekräftelse via e-post</span>
          </label>
        )}
        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="h-12 px-6 rounded-full bg-white/10 font-bold">Avbryt</button>
          <button onClick={save} disabled={busy || !canSubmit} className="flex-1 h-12 rounded-full bg-white text-black font-bold disabled:opacity-40">
            {busy ? 'Lägger till…' : creating ? 'Skapa och lägg till' : 'Lägg till på kursen'}
          </button>
        </div>
      </div>
    </Sheet>
  );
}
