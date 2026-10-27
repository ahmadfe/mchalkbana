'use client';

import { useEffect, useState } from 'react';
import { Mail, Phone, X } from 'lucide-react';
import clsx from 'clsx';
import { ageFromPersonnummer, formatPersonnummer, normalizePersonnummer } from '@/lib/pnr';

export interface CheckInPerson {
  bookingId: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  personnummer?: string | null;
  behorighet?: string | null;
}

const ID_OPTIONS = [
  { value: 'korkort', label: 'Körkort' },
  { value: 'pass', label: 'Pass' },
  { value: 'nationellt_id', label: 'Nationellt id-kort' },
  { value: 'id_kort', label: 'Id-kort (godkänt)' },
];

/** Incheckning: kontrollera legitimation och personnummer innan deltagaren får vara med. Används av admin och lärare. */
export default function CheckInModal({ person, onClose, onDone, instructors }: {
  person: CheckInPerson;
  onClose: () => void;
  onDone: () => void;
  /** Kursens lärare – skickas från admin. Läraren som checkar in själv behöver inte välja. */
  instructors?: { id: number; name: string }[];
}) {
  const original = normalizePersonnummer(person.personnummer);
  const [editing, setEditing] = useState(!original);
  const [pnrInput, setPnrInput] = useState(original ? formatPersonnummer(original) : '');
  const [idType, setIdType] = useState('');
  const [instructorId, setInstructorId] = useState(instructors?.[0]?.id ?? 0);
  const noInstructor = !!instructors && instructors.length === 0;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const pnr = editing ? normalizePersonnummer(pnrInput) : original;
  const age = pnr ? ageFromPersonnummer(pnr) : null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, busy]);

  const confirm = async () => {
    setBusy(true);
    setError('');
    const res = await fetch(`/api/checkin/${person.bookingId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idType,
        ...(editing && pnr !== original ? { personnummer: pnrInput } : {}),
        ...(instructors && instructorId ? { instructorId } : {}),
      }),
    });
    setBusy(false);
    if (!res.ok) { setError((await res.json()).error ?? 'Något gick fel'); return; }
    onDone();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4" onClick={() => !busy && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Checka in ${person.name}`}
        onClick={e => e.stopPropagation()}
        className="w-full sm:max-w-lg bg-[#1c1c1f] text-white rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 pb-[calc(1.25rem+env(safe-area-inset-bottom))] max-h-[95vh] overflow-y-auto"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-white/60">Checka in deltagare</p>
            <h2 className="font-headline text-xl font-extrabold mt-1 break-words">{person.name}</h2>
            <p className="text-sm text-white/60 mt-1">Kontrollera legitimationen och se till att personnumret stämmer.</p>
          </div>
          <button onClick={onClose} disabled={busy} aria-label="Stäng" className="w-11 h-11 shrink-0 rounded-full bg-white/10 hover:bg-white/15 flex items-center justify-center">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-white/70 mt-4">
          {person.email && <span className="inline-flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" />{person.email}</span>}
          {person.phone && <span className="inline-flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" />{person.phone}</span>}
          {person.behorighet && <span>Behörighet {person.behorighet}</span>}
        </div>

        <div className="flex items-center justify-between mt-6 mb-2">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-white/60">Personnummer (ÅÅÅÅMMDD-XXXX)</p>
          {original && (
            <button onClick={() => { setEditing(!editing); setPnrInput(formatPersonnummer(original)); }} className="text-xs text-white/50 hover:text-white underline">
              {editing ? 'Ångra' : 'Stämmer inte?'}
            </button>
          )}
        </div>
        {editing ? (
          <input
            value={pnrInput}
            onChange={e => setPnrInput(e.target.value)}
            placeholder="ÅÅÅÅMMDD-XXXX"
            inputMode="numeric"
            autoFocus
            className="w-full h-16 px-4 rounded-2xl bg-[#26262a] border border-white/15 text-2xl font-mono text-center tracking-wider focus:outline-none focus:border-emerald-500/60"
          />
        ) : pnr && (
          <div className="rounded-2xl bg-emerald-950/50 border border-emerald-700/40 py-5 text-center font-mono">
            <span className="text-3xl sm:text-4xl font-bold tracking-wide">{pnr.slice(0, 8)}</span>
            <span className="text-2xl sm:text-3xl text-white/60">–{pnr.slice(8)}</span>
          </div>
        )}
        <p className="text-center text-sm text-white/60 mt-2 h-5">
          {age !== null ? `${age} år` : editing && pnrInput ? 'Ogiltigt personnummer' : ''}
        </p>
        {editing && original && <p className="text-sm text-amber-300/90 mt-1">Det rättade personnumret sparas på bokningen och i registret.</p>}

        <p className="text-xs font-bold uppercase tracking-[0.12em] text-white/60 mt-5 mb-3">Vilken legitimation visade deltagaren?</p>
        <div className="grid grid-cols-2 gap-3">
          {ID_OPTIONS.map(o => (
            <button
              key={o.value}
              onClick={() => setIdType(o.value)}
              className={clsx(
                'h-14 rounded-2xl text-[15px] font-bold border transition',
                idType === o.value ? 'border-emerald-400 bg-emerald-500/10 ring-1 ring-emerald-400' : 'border-white/10 hover:border-white/30',
              )}
            >
              {o.label}
            </button>
          ))}
        </div>

        {instructors && (
          noInstructor ? (
            <p className="text-sm text-amber-300 bg-amber-500/10 rounded-xl px-4 py-3 mt-5">
              Kursen har ingen lärare tilldelad. Tilldela en lärare (Redigera kursen) innan du checkar in – läraren står som &quot;Incheckad av&quot; i riskregistret.
            </p>
          ) : (
            <div className="mt-5">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-white/60 mb-2">Incheckad av (kursens lärare)</p>
              {instructors.length === 1 ? (
                <p className="h-12 px-4 rounded-2xl border border-white/10 flex items-center font-semibold">{instructors[0].name}</p>
              ) : (
                <select
                  value={instructorId}
                  onChange={e => setInstructorId(Number(e.target.value))}
                  className="w-full h-12 px-4 rounded-2xl bg-[#26262a] border border-white/10 text-white font-semibold [color-scheme:dark] focus:outline-none focus:border-white/40"
                >
                  {instructors.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
              )}
            </div>
          )
        )}

        {error && <p className="text-sm text-red-400 mt-4">{error}</p>}

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} disabled={busy} className="h-12 px-6 rounded-full bg-white/10 font-bold hover:bg-white/15">Avbryt</button>
          <button
            onClick={confirm}
            disabled={!idType || !pnr || busy || noInstructor}
            className="flex-1 h-12 rounded-full bg-white text-black font-bold hover:bg-white/90 disabled:bg-white/10 disabled:text-white/30"
          >
            {busy ? 'Checkar in…' : 'Bekräfta'}
          </button>
        </div>
      </div>
    </div>
  );
}
