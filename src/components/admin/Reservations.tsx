'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button, Field, Input, Select } from './ui';

export interface SchoolAccount { id: number; name: string; email: string }

export interface ReservationDraft {
  key: string;
  schoolUserId: string;
  seats: string;
  fillBy: string; // ÅÅÅÅ-MM-DD
  /** Följer kursdatumet (2 dagar före) tills admin ändrar datumet själv. */
  fillByAuto: boolean;
  meetingPlace: string;
  message: string;
}

/** Standard för "fyll senast": 2 dagar före kursen, men aldrig tidigare än i dag. */
export function defaultFillBy(courseDate: string): string {
  const d = new Date(`${courseDate}T12:00:00`);
  if (isNaN(d.getTime())) return '';
  d.setDate(d.getDate() - 2);
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' });
  const ymd = d.toLocaleDateString('sv-SE');
  return ymd < today ? today : ymd;
}

export function newReservation(courseDate: string): ReservationDraft {
  return {
    key: Math.random().toString(36).slice(2),
    schoolUserId: '',
    seats: '1',
    fillBy: defaultFillBy(courseDate),
    fillByAuto: true,
    meetingPlace: '',
    message: '',
  };
}

export function reservationPayload(r: ReservationDraft) {
  return { schoolUserId: Number(r.schoolUserId), seats: Number(r.seats), fillBy: r.fillBy || null, meetingPlace: r.meetingPlace, message: r.message };
}

/** Trafikskolor och mötesplatsförslag, laddas en gång per formulär. */
export function useReservationData() {
  const [schools, setSchools] = useState<SchoolAccount[]>([]);
  const [places, setPlaces] = useState<string[]>([]);
  const reload = useCallback(() => {
    fetch('/api/admin/school-accounts').then(r => r.json()).then(d => setSchools((d.accounts ?? []).sort((a: SchoolAccount, b: SchoolAccount) => a.name.localeCompare(b.name, 'sv'))));
  }, []);
  useEffect(() => {
    reload();
    fetch('/api/admin/motesplatser').then(r => r.json()).then(d => setPlaces(d.motesplatser ?? []));
  }, [reload]);
  return { schools, places, addSchool: (s: SchoolAccount) => setSchools(prev => [...prev, s].sort((a, b) => a.name.localeCompare(b.name, 'sv'))) };
}

/** Rad med fälten för en reservation (som bild 2): skola, platser, fyll senast, mötesplats och meddelande. */
export function ReservationFields({
  value,
  onChange,
  schools,
  places,
  onSchoolCreated,
  maxSeats,
  takenSchoolIds = [],
  lockSchool = false,
}: {
  value: ReservationDraft;
  onChange: (v: ReservationDraft) => void;
  schools: SchoolAccount[];
  places: string[];
  onSchoolCreated: (s: SchoolAccount) => void;
  maxSeats?: number;
  takenSchoolIds?: string[];
  lockSchool?: boolean;
}) {
  const [creating, setCreating] = useState(false);
  const set = <K extends keyof ReservationDraft>(k: K, v: ReservationDraft[K]) => onChange({ ...value, [k]: v });
  const listId = `motesplatser-${value.key}`;

  return (
    <div className="space-y-4">
      {creating ? (
        <NewSchoolForm
          onCancel={() => setCreating(false)}
          onCreated={s => { onSchoolCreated(s); onChange({ ...value, schoolUserId: String(s.id) }); setCreating(false); }}
        />
      ) : (
        <Field label="Trafikskola">
          <Select
            key={schools.length}
            value={value.schoolUserId}
            disabled={lockSchool}
            onChange={e => (e.target.value === 'new' ? setCreating(true) : set('schoolUserId', e.target.value))}
          >
            <option value="">Välj trafikskola</option>
            {schools.map(s => (
              <option key={s.id} value={s.id} disabled={takenSchoolIds.includes(String(s.id)) && String(s.id) !== value.schoolUserId}>
                {s.name}
              </option>
            ))}
            {!lockSchool && <option value="new">+ Ny trafikskola…</option>}
          </Select>
        </Field>
      )}
      <div className="grid grid-cols-2 gap-4">
        <Field label={maxSeats !== undefined ? `Platser (högst ${maxSeats})` : 'Platser'}>
          <Input type="number" min={1} max={maxSeats} value={value.seats} onChange={e => set('seats', e.target.value)} />
        </Field>
        <Field label="Fyll senast">
          <Input type="date" value={value.fillBy} onChange={e => onChange({ ...value, fillBy: e.target.value, fillByAuto: false })} />
        </Field>
      </div>
      <Field label="Mötesplats för skolans elever" hint="Lämna tomt för kursens mötesplats. Skolans elever får den här adressen i alla mejl.">
        <Input list={listId} value={value.meetingPlace} onChange={e => set('meetingPlace', e.target.value)} placeholder="Välj eller skriv en adress" />
        <datalist id={listId}>{places.map(p => <option key={p} value={p} />)}</datalist>
      </Field>
      <Field label="Meddelande till skolan (valfritt)">
        <Input value={value.message} onChange={e => set('message', e.target.value)} placeholder="T.ex. enligt avtal för hösten" />
      </Field>
    </div>
  );
}

/** Skapar ett skolkonto direkt i formuläret. Lösenordet skapas automatiskt, mejlas och visas en gång. */
function NewSchoolForm({ onCancel, onCreated }: { onCancel: () => void; onCreated: (s: SchoolAccount) => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState<{ account: SchoolAccount; password: string } | null>(null);

  const create = async () => {
    setBusy(true);
    setError('');
    const res = await fetch('/api/admin/school-accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, phone }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) { setError(data.error ?? 'Kunde inte skapa kontot'); return; }
    setCreated({ account: data.account, password: data.password });
  };

  if (created) {
    return (
      <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/30 p-4 space-y-2">
        <p className="text-sm font-bold text-emerald-300">✓ Kontot för {created.account.name} är skapat</p>
        <p className="text-sm text-white/70">Inloggningen har mejlats till {created.account.email}. Lösenordet visas bara nu:</p>
        <div className="flex items-center gap-2">
          <code className="px-3 py-1.5 rounded-lg bg-black/30 font-mono text-white select-all">{created.password}</code>
          <Button className="!h-9" onClick={() => navigator.clipboard.writeText(created.password)}>Kopiera</Button>
        </div>
        <Button variant="primary" className="!h-9 mt-1" onClick={() => onCreated(created.account)}>Fortsätt</Button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-3">
      <p className="text-sm font-bold">Ny trafikskola</p>
      <div className="grid sm:grid-cols-2 gap-3">
        <Input placeholder="Skolans namn *" value={name} onChange={e => setName(e.target.value)} />
        <Input type="email" placeholder="E-post för inloggning *" value={email} onChange={e => setEmail(e.target.value)} />
        <Input type="tel" placeholder="Telefon" value={phone} onChange={e => setPhone(e.target.value)} className="sm:col-span-2" />
      </div>
      <p className="text-xs text-white/50">Ett lösenord skapas automatiskt och skickas till skolan.</p>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex gap-2">
        <Button className="!h-9" onClick={onCancel} disabled={busy}>Avbryt</Button>
        <Button variant="primary" className="!h-9" onClick={create} disabled={busy || !name.trim() || !email.trim()}>{busy ? 'Skapar…' : 'Skapa konto'}</Button>
      </div>
    </div>
  );
}
