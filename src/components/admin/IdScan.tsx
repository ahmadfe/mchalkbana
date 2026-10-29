'use client';

import { useState } from 'react';
import { AlertTriangle, Camera, CheckCircle2, ScanLine, X, XCircle } from 'lucide-react';
import clsx from 'clsx';
import { normalizePersonnummer, personnummerChecksumOk } from '@/lib/pnr';
import { Button, Checkbox } from './ui';

type IdType = 'korkort' | 'pass' | 'nationellt_id' | 'id_kort' | 'okand';
interface ScanRow {
  firstName: string; lastName: string; personnummer: string; idType: IdType;
  confidence: 'high' | 'low'; note: string; checksumOk: boolean; existingStudent: string | null; alreadyBooked: boolean;
}
interface EditRow extends ScanRow { include: boolean }
interface Result { name: string; ok: boolean; message: string }

const ID_LABEL: Record<IdType, string> = { korkort: 'Körkort', pass: 'Pass', nationellt_id: 'Nationellt id-kort', id_kort: 'Id-kort', okand: 'Okänd' };
const MAX_PHOTOS = 4;
const tz = { timeZone: 'Europe/Stockholm' } as const;

/** Krymper fotot i webbläsaren (långsida 2048 px, JPEG) – mobilfoton är annars för stora att skicka. */
async function shrink(file: File): Promise<{ mediaType: 'image/jpeg'; data: string; preview: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 2048 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const url = canvas.toDataURL('image/jpeg', 0.88);
  return { mediaType: 'image/jpeg', data: url.split(',')[1], preview: url };
}

const pnrOk = (v: string) => { const n = normalizePersonnummer(v); return !!n && personnummerChecksumOk(n); };

/** "Läs in legitimationer": foton av körkort/pass/id-kort → granska → anmäl (och checka in på kursdagen). */
export default function IdScan({ kursId, courseStart, instructors, onDone }: {
  kursId: number;
  courseStart: string;
  instructors: { id: number; name: string }[];
  onDone: () => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);
  const [photos, setPhotos] = useState<{ mediaType: 'image/jpeg'; data: string; preview: string }[]>([]);
  const [rows, setRows] = useState<EditRow[] | null>(null);
  const [freeSeats, setFreeSeats] = useState(0);
  const [busy, setBusy] = useState<'' | 'reading' | 'saving'>('');
  const [error, setError] = useState('');
  const [results, setResults] = useState<Result[] | null>(null);
  const isCourseDay = new Date(courseStart).toLocaleDateString('sv-SE', tz) === new Date().toLocaleDateString('sv-SE', tz);
  const [checkIn, setCheckIn] = useState(isCourseDay);
  const [instructorId, setInstructorId] = useState(instructors[0]?.id ?? 0);

  const reset = () => { setPhotos([]); setRows(null); setResults(null); setError(''); setBusy(''); };
  const close = () => { if (busy) return; setOpen(false); reset(); };

  const pick = async (files: FileList | null) => {
    if (!files?.length) return;
    setError('');
    const chosen = Array.from(files).slice(0, MAX_PHOTOS - photos.length);
    try {
      const shrunk = await Promise.all(chosen.map(shrink));
      setPhotos(p => [...p, ...shrunk].slice(0, MAX_PHOTOS));
    } catch {
      setError('Fotot kunde inte öppnas – prova JPEG eller PNG');
    }
  };

  const read = async () => {
    setBusy('reading');
    setError('');
    const res = await fetch(`/api/admin/kurser/${kursId}/legitimationer/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ images: photos.map(({ mediaType, data }) => ({ mediaType, data })) }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy('');
    if (!res.ok) { setError(data.error ?? 'Korten kunde inte läsas'); return; }
    setFreeSeats(data.freeSeats);
    setRows((data.rows as ScanRow[]).map(r => ({ ...r, include: r.checksumOk && !r.alreadyBooked })));
    // Bilderna behövs inte längre – släpp dem direkt
    setPhotos([]);
  };

  const update = (i: number, patch: Partial<EditRow>) => setRows(rs => rs && rs.map((r, j) => {
    if (j !== i) return r;
    const next = { ...r, ...patch };
    if (patch.personnummer !== undefined) next.checksumOk = pnrOk(patch.personnummer);
    return next;
  }));

  const selected = rows?.filter(r => r.include) ?? [];
  const invalid = selected.filter(r => !r.checksumOk || !r.firstName.trim() || !r.lastName.trim());
  const canCheckIn = isCourseDay && instructors.length > 0;

  const save = async () => {
    setBusy('saving');
    setError('');
    const res = await fetch(`/api/admin/kurser/${kursId}/legitimationer/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rows: selected.map(({ firstName, lastName, personnummer, idType }) => ({ firstName, lastName, personnummer, idType })),
        checkIn: checkIn && canCheckIn,
        instructorId,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy('');
    if (!res.ok) { setError(data.error ?? 'Något gick fel'); return; }
    setResults(data.results);
    await onDone();
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full h-12 mt-4 rounded-2xl border border-dashed border-white/20 text-white/70 hover:text-white hover:border-white/40 font-semibold inline-flex items-center justify-center gap-2"
      >
        <ScanLine className="w-5 h-5" /> Läs in legitimationer från foto
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" onClick={close}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Läs in legitimationer"
            onClick={e => e.stopPropagation()}
            className="sheet bg-[#1c1c1f] text-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-3xl max-h-[92dvh] overflow-y-auto p-5 sm:p-6 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-6"
          >
            <div className="flex items-start justify-between gap-3 mb-4 pt-2 sm:pt-0">
              <div>
                <h3 className="font-headline text-xl font-extrabold">Läs in legitimationer</h3>
                <p className="text-sm text-white/55 mt-0.5">Fota körkort, pass och id-kort – upp till {MAX_PHOTOS} foton. Fotona sparas inte.</p>
              </div>
              <button onClick={close} aria-label="Stäng" className="w-10 h-10 -mr-2 rounded-full hover:bg-white/10 flex items-center justify-center shrink-0"><X className="w-5 h-5" /></button>
            </div>

            {results ? (
              <div className="space-y-2">
                {results.map((r, i) => (
                  <p key={i} className={clsx('flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm', r.ok ? 'bg-emerald-500/10' : 'bg-red-500/10')}>
                    {r.ok ? <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0 mt-0.5" /> : <XCircle className="w-4 h-4 text-red-300 shrink-0 mt-0.5" />}
                    <span><strong>{r.name}</strong> – {r.message}</span>
                  </p>
                ))}
                <div className="flex gap-3 pt-3">
                  <Button onClick={reset}>Läs in fler</Button>
                  <Button variant="primary" className="flex-1" onClick={close}>Klar</Button>
                </div>
              </div>
            ) : rows ? (
              <>
                {rows.length === 0 ? (
                  <p className="rounded-xl bg-white/5 px-4 py-6 text-center text-white/60">Inga legitimationer hittades på fotot. Prova ett skarpare foto med korten närmare.</p>
                ) : (
                  <div className="space-y-2">
                    {rows.map((r, i) => (
                      <div key={i} className={clsx('rounded-2xl border p-3 sm:p-4', r.include ? 'border-white/15 bg-white/[0.03]' : 'border-white/5 opacity-60')}>
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={r.include}
                            disabled={r.alreadyBooked}
                            onChange={e => update(i, { include: e.target.checked })}
                            aria-label="Ta med"
                            className="w-5 h-5 mt-3 accent-white shrink-0"
                          />
                          <div className="grid grid-cols-2 sm:grid-cols-[1fr_1fr_1.2fr_1fr] gap-2 flex-1 min-w-0">
                            <input value={r.firstName} onChange={e => update(i, { firstName: e.target.value })} placeholder="Förnamn" className="h-11 px-3 rounded-xl bg-[#26262a] border border-white/10 text-white min-w-0" />
                            <input value={r.lastName} onChange={e => update(i, { lastName: e.target.value })} placeholder="Efternamn" className="h-11 px-3 rounded-xl bg-[#26262a] border border-white/10 text-white min-w-0" />
                            <input
                              value={r.personnummer}
                              onChange={e => update(i, { personnummer: e.target.value })}
                              placeholder="ÅÅÅÅMMDD-XXXX"
                              inputMode="numeric"
                              className={clsx('h-11 px-3 rounded-xl bg-[#26262a] border font-mono text-white min-w-0', r.checksumOk ? 'border-white/10' : 'border-red-500/70')}
                            />
                            <select value={r.idType} onChange={e => update(i, { idType: e.target.value as IdType })} className="h-11 px-3 rounded-xl bg-[#26262a] border border-white/10 text-white [color-scheme:dark] min-w-0">
                              {(Object.keys(ID_LABEL) as IdType[]).map(t => <option key={t} value={t}>{ID_LABEL[t]}</option>)}
                            </select>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 ml-8 text-xs">
                          {!r.checksumOk && <span className="text-red-300">Personnumret stämmer inte – kontrollera mot kortet</span>}
                          {r.alreadyBooked && <span className="text-white/60">Redan anmäld till kursen</span>}
                          {r.existingStudent && !r.alreadyBooked && <span className="text-sky-300">Finns i elevregistret</span>}
                          {r.confidence === 'low' && <span className="inline-flex items-center gap-1 text-amber-300"><AlertTriangle className="w-3 h-3" />Osäker läsning{r.note ? `: ${r.note}` : ''}</span>}
                          {r.idType === 'okand' && r.include && <span className="text-amber-300">Välj legitimation</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {rows.length > 0 && (
                  <div className="mt-4 space-y-3">
                    <p className={clsx('text-sm', selected.length > freeSeats ? 'text-red-300' : 'text-white/60')}>
                      {selected.length} valda · {freeSeats} platser kvar på kursen{selected.length > freeSeats ? ' – välj bort några eller öka antalet platser' : ''}
                    </p>
                    {isCourseDay ? (
                      instructors.length === 0 ? (
                        <p className="text-sm text-amber-300">Kursen har ingen lärare – eleverna anmäls men checkas inte in.</p>
                      ) : (
                        <div className="space-y-2">
                          <Checkbox checked={checkIn} onChange={setCheckIn}>Checka in med legitimationen från fotot</Checkbox>
                          {checkIn && instructors.length > 1 && (
                            <select value={instructorId} onChange={e => setInstructorId(Number(e.target.value))} className="h-11 px-3 rounded-xl bg-[#26262a] border border-white/10 text-white [color-scheme:dark] ml-9">
                              {instructors.map(t => <option key={t.id} value={t.id}>Incheckad av {t.name}</option>)}
                            </select>
                          )}
                        </div>
                      )
                    ) : (
                      <p className="text-sm text-white/50">Eleverna anmäls. Läraren checkar in dem på kursdagen.</p>
                    )}
                  </div>
                )}

                {error && <p className="text-sm text-red-400 mt-3">{error}</p>}
                <div className="flex gap-3 mt-5">
                  <Button onClick={reset}>Börja om</Button>
                  <Button
                    variant="primary"
                    className="flex-1"
                    disabled={busy !== '' || selected.length === 0 || invalid.length > 0 || selected.length > freeSeats || (checkIn && canCheckIn && selected.some(r => r.idType === 'okand'))}
                    onClick={save}
                  >
                    {busy === 'saving' ? 'Sparar…' : `Lägg till ${selected.length} elev${selected.length === 1 ? '' : 'er'}`}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <label className="flex flex-col items-center justify-center gap-2 h-36 rounded-2xl border-2 border-dashed border-white/15 hover:border-white/30 cursor-pointer text-white/60 hover:text-white">
                  <Camera className="w-8 h-8" />
                  <span className="font-semibold">{photos.length ? 'Lägg till fler foton' : 'Ta foto eller välj bilder'}</span>
                  <span className="text-xs text-white/40">Lägg korten platt, utan reflexer – gärna högst 4 kort per foto</span>
                  <input type="file" accept="image/*" multiple className="hidden" onChange={e => { pick(e.target.files); e.target.value = ''; }} disabled={photos.length >= MAX_PHOTOS} />
                </label>
                {photos.length > 0 && (
                  <div className="grid grid-cols-4 gap-2 mt-3">
                    {photos.map((p, i) => (
                      <div key={i} className="relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.preview} alt={`Foto ${i + 1}`} className="w-full aspect-[4/3] object-cover rounded-xl" />
                        <button onClick={() => setPhotos(ps => ps.filter((_, j) => j !== i))} aria-label="Ta bort foto" className="absolute top-1 right-1 w-8 h-8 rounded-full bg-black/70 flex items-center justify-center"><X className="w-4 h-4" /></button>
                      </div>
                    ))}
                  </div>
                )}
                {error && <p className="text-sm text-red-400 mt-3">{error}</p>}
                <div className="flex gap-3 mt-5">
                  <Button onClick={close}>Avbryt</Button>
                  <Button variant="primary" className="flex-1" disabled={photos.length === 0 || busy !== ''} onClick={read}>
                    {busy === 'reading' ? 'Läser korten… (upp till en halv minut)' : `Läs korten på ${photos.length} foto${photos.length === 1 ? '' : 'n'}`}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
