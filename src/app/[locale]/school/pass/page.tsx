'use client';

import { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import {
  AlarmClock, Calendar, CheckCircle2, ChevronRight, Clock, Lock, Mail, MapPin, MessageSquare, Phone, Plus, Trash2, X,
} from 'lucide-react';
import clsx from 'clsx';
import { SchoolPage, useSchool } from '@/components/school/SchoolShell';
import { buildPasses, hm, KIND, kr, tz, type PassItem } from '@/components/school/shared';
import { Button, Checkbox, Field, Input, Textarea } from '@/components/admin/ui';
import { courseKind } from '@/lib/courseKind';
import type { Session } from '@/lib/types';

interface StudentForm { name: string; personnummer: string; phone: string; email: string; note: string; sendConfirmation: boolean }
const emptyStudent = (): StudentForm => ({ name: '', personnummer: '', phone: '', email: '', note: '', sendConfirmation: false });

export default function SchoolPassPage() {
  const locale = useLocale();
  const { sessions, bookings, priceMap, reload } = useSchool();
  const [view, setView] = useState<'upcoming' | 'archived'>('upcoming');
  // Valt pass: öppet kort på mobilen, detaljvyn till höger på surfplatta/dator
  const [selectedId, setSelectedId] = useState<number | null>(null);
  // ?id=123 från översikten öppnar det passet
  useEffect(() => { const id = Number(new URLSearchParams(window.location.search).get('id')); if (id) setSelectedId(id); }, []);

  // Lägg till elever
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [activeRemaining, setActiveRemaining] = useState(0);
  const [students, setStudents] = useState<StudentForm[]>([emptyStudent()]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const { upcoming, archived } = buildPasses(sessions, bookings, priceMap, locale);
  const items = view === 'upcoming' ? upcoming : archived;
  const selected = items.find((i) => i.id === selectedId) ?? null;
  // Surfplatta/dator visar alltid ett pass till höger – det valda eller det första
  const shown = selected ?? items[0] ?? null;

  const openModal = (session: Session, remaining: number) => {
    setActiveSession(session);
    setActiveRemaining(remaining);
    setStudents([emptyStudent()]);
    setSaveError('');
    setSaveSuccess(false);
  };
  const updateStudentRow = (i: number, field: keyof StudentForm, value: string | boolean) =>
    setStudents((p) => p.map((s, idx) => (idx === i ? { ...s, [field]: value } : s)));

  const handleSaveStudents = async () => {
    if (!activeSession) return;
    if (!students.every((s) => s.name.trim() && s.personnummer.trim())) { setSaveError('Namn och personnummer krävs för alla elever.'); return; }
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
        const data = await res.json().catch(() => ({}));
        setSaveError(`Fel för ${student.name}: ${data.error ?? 'okänt fel'}`);
        setSaving(false);
        await reload();
        return;
      }
    }
    setSaving(false);
    setSaveSuccess(true);
    await reload();
    setSelectedId(activeSession.id);
    setTimeout(() => { setActiveSession(null); setSaveSuccess(false); }, 1200);
  };

  const handleDeleteStudent = async (bookingId: number) => {
    await fetch(`/api/school/bookings/${bookingId}`, { method: 'DELETE' });
    await reload();
  };

  const detail = (item: PassItem) => (
    <PassDetail item={item} onAdd={() => openModal(item.session, item.remaining)} onDelete={item.readOnly ? undefined : handleDeleteStudent} />
  );

  return (
    <SchoolPage title="Pass" subtitle="Lägg till elever på era pass">
      {/* Kommande / Arkiverade */}
      <div className="flex p-1 rounded-2xl bg-[#1c1c1f] sm:max-w-sm">
        {([['upcoming', `Kommande (${upcoming.length})`], ['archived', `Arkiverade (${archived.length})`]] as const).map(([v, label]) => (
          <button
            key={v}
            onClick={() => { setView(v); setSelectedId(null); }}
            className={clsx('flex-1 h-10 rounded-xl text-sm font-semibold transition', view === v ? 'bg-white text-black' : 'text-white/60 hover:text-white')}
          >
            {label}
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <div className="text-center py-16 px-6 rounded-3xl bg-[#1c1c1f]">
          <Calendar className="w-10 h-10 mx-auto mb-3 text-white/25" strokeWidth={1.5} />
          {view === 'upcoming' ? (
            <>
              <p className="font-semibold">Inga tillgängliga pass</p>
              <p className="text-sm text-white/50 mt-1">Kontakta oss för att få platser på ett pass.</p>
            </>
          ) : (
            <>
              <p className="font-semibold">Inga arkiverade pass än</p>
              <p className="text-sm text-white/50 mt-1">Pass hamnar här när de har börjat.</p>
            </>
          )}
        </div>
      ) : (
        <div className="md:grid md:grid-cols-[minmax(0,300px)_minmax(0,1fr)] lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] md:gap-5 md:items-start">
          <div className="space-y-2">
            {view === 'archived' && (
              <p className="text-xs text-white/50 px-1 pb-1">Passen har börjat eller är genomförda och kan inte ändras. Kontakta oss om något behöver rättas.</p>
            )}
            {items.map((item) => {
              const open = selectedId === item.id;
              return (
                <div key={item.id}>
                  <PassCard item={item} open={open} active={shown?.id === item.id} onClick={() => setSelectedId(open ? null : item.id)} />
                  {/* Mobil: detaljerna öppnas under kortet */}
                  {open && <div className="md:hidden mt-2">{detail(item)}</div>}
                </div>
              );
            })}
          </div>
          {/* Surfplatta/dator: valt pass bredvid listan */}
          {shown && <div className="hidden md:block md:sticky md:top-[calc(1.5rem+env(safe-area-inset-top))]">{detail(shown)}</div>}
        </div>
      )}

      {/* Lägg till elever – glider upp från botten på mobilen */}
      {activeSession && (
        <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" onClick={() => !saving && setActiveSession(null)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Lägg till elever"
            onClick={(e) => e.stopPropagation()}
            className="sheet bg-[#1c1c1f] text-white rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-6 max-w-xl w-full shadow-2xl max-h-[92dvh] flex flex-col"
          >
            <div className="flex items-start justify-between gap-3 mb-4 pt-2 sm:pt-0">
              <div className="min-w-0">
                <h3 className="font-headline font-extrabold text-xl">Lägg till elever</h3>
                <p className="text-sm text-white/50 mt-0.5">
                  {(locale === 'sv' ? activeSession.course?.titleSv : activeSession.course?.titleEn) ?? ''} · {new Date(activeSession.startTime).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', ...tz })} · {activeRemaining} {activeRemaining === 1 ? 'plats' : 'platser'} kvar
                </p>
              </div>
              <button onClick={() => setActiveSession(null)} aria-label="Stäng" className="w-10 h-10 -mr-2 rounded-full hover:bg-white/10 flex items-center justify-center text-white/60 shrink-0">
                <X className="w-5 h-5" />
              </button>
            </div>

            {saveSuccess ? (
              <div className="flex-1 flex flex-col items-center justify-center py-10 text-center">
                <CheckCircle2 className="w-12 h-12 text-emerald-400 mb-3" />
                <p className="font-semibold">Eleverna är tillagda!</p>
              </div>
            ) : (
              <>
                <div className="overflow-auto flex-1 space-y-3 -mx-1 px-1">
                  {saveError && <div className="rounded-xl px-4 py-3 text-sm bg-red-500/10 text-red-300">{saveError}</div>}
                  {students.map((s, i) => (
                    <div key={i} className="rounded-2xl bg-white/[0.04] border border-white/5 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-white/80">Elev {i + 1}</span>
                        {students.length > 1 && (
                          <button onClick={() => setStudents((p) => p.filter((_, idx) => idx !== i))} aria-label={`Ta bort elev ${i + 1}`} className="w-9 h-9 -mr-2 rounded-full text-white/40 hover:text-red-400 hover:bg-red-500/10 flex items-center justify-center">
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <div className="grid sm:grid-cols-2 gap-3">
                        <Field label="Namn" required>
                          <Input type="text" placeholder="Anna Svensson" autoComplete="off" value={s.name} onChange={(e) => updateStudentRow(i, 'name', e.target.value)} />
                        </Field>
                        <Field label="Personnummer" required>
                          <Input type="text" inputMode="numeric" className="font-mono" placeholder="ÅÅÅÅMMDD-XXXX" autoComplete="off" value={s.personnummer} onChange={(e) => updateStudentRow(i, 'personnummer', e.target.value)} />
                        </Field>
                        <Field label="Telefon">
                          <Input type="tel" placeholder="070-123 45 67" value={s.phone} onChange={(e) => updateStudentRow(i, 'phone', e.target.value)} />
                        </Field>
                        <Field label="E-post">
                          <Input type="email" placeholder="anna@skola.se" value={s.email} onChange={(e) => updateStudentRow(i, 'email', e.target.value)} />
                        </Field>
                        <Field label="Anteckning" className="sm:col-span-2">
                          <Textarea
                            className="min-h-[64px]"
                            placeholder="Valfritt – t.ex. behöver tolk, kommer lite sent, referens för fakturan"
                            maxLength={500}
                            value={s.note}
                            onChange={(e) => updateStudentRow(i, 'note', e.target.value)}
                          />
                        </Field>
                      </div>
                      {s.email && (
                        <Checkbox checked={s.sendConfirmation} onChange={(v) => updateStudentRow(i, 'sendConfirmation', v)}>
                          <span className="text-sm text-white/70">Skicka bokningsbekräftelse via e-post</span>
                        </Checkbox>
                      )}
                    </div>
                  ))}
                  <button
                    onClick={() => setStudents((p) => [...p, emptyStudent()])}
                    disabled={students.length >= activeRemaining}
                    className="w-full h-12 flex items-center justify-center gap-2 border-2 border-dashed border-white/15 rounded-2xl text-sm font-semibold text-white/60 hover:border-white/40 hover:text-white transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Plus className="w-4 h-4" />Lägg till fler elever
                  </button>
                </div>

                <div className="flex gap-3 pt-4 mt-3 border-t border-white/5">
                  <Button onClick={() => setActiveSession(null)} className="h-12 px-6">Avbryt</Button>
                  <Button variant="primary" onClick={handleSaveStudents} disabled={saving} className="flex-1 h-12 font-bold">
                    {saving ? 'Sparar…' : `Spara ${students.length} elev${students.length !== 1 ? 'er' : ''}`}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </SchoolPage>
  );
}

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
        'w-full text-left flex items-center gap-3 rounded-2xl p-3 sm:p-4 transition bg-[#1c1c1f] ring-1',
        open ? 'ring-white/40' : 'ring-transparent hover:bg-[#232327]',
        active ? 'md:ring-white/40' : 'md:ring-transparent',
      )}
    >
      <div className="w-12 shrink-0 text-center rounded-xl bg-white/5 py-1.5">
        <p className="text-[11px] font-semibold uppercase text-white/50 leading-none">{item.start.toLocaleDateString('sv-SE', { month: 'short', ...tz }).replace('.', '')}</p>
        <p className="font-headline text-xl font-extrabold leading-tight">{item.start.toLocaleDateString('sv-SE', { day: 'numeric', ...tz })}</p>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={clsx('text-[11px] font-bold px-1.5 py-0.5 rounded-md shrink-0', kind.cls)}>{kind.label}</span>
          <p className="font-semibold truncate">{item.title}</p>
        </div>
        <p className="text-sm text-white/50 mt-0.5 truncate">
          {item.start.toLocaleDateString('sv-SE', { weekday: 'short', ...tz })} {hm(item.start)}–{hm(item.end)}
        </p>
        <p className={clsx('text-xs font-semibold mt-1', item.readOnly ? 'text-white/40' : item.locked ? 'text-red-400' : 'text-emerald-400')}>
          {item.readOnly ? <><Lock className="inline w-3 h-3 -mt-0.5" /> {item.end < new Date() ? 'Genomfört' : 'Pågår'} · {status}</> : item.deadlinePassed ? `Stängt · ${status}` : status}
        </p>
      </div>
      <ChevronRight className={clsx('w-5 h-5 text-white/30 shrink-0 transition', open && 'rotate-90 md:rotate-0')} />
    </button>
  );
}

/** Ett pass i detalj: plats, pris, meddelande och skolans elever. */
function PassDetail({ item, onAdd, onDelete }: { item: PassItem; onAdd: () => void; onDelete?: (bookingId: number) => void }) {
  const r = item.reservation;
  return (
    <div className="rounded-3xl bg-[#1c1c1f] p-5 sm:p-6 space-y-5">
      <div>
        <h2 className="font-headline text-xl sm:text-2xl font-extrabold">{item.title}</h2>
        <p className="text-sm text-white/60 mt-1 capitalize">{item.start.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long', ...tz })}</p>
      </div>

      <div className="space-y-2 text-sm text-white/80">
        <p className="flex items-center gap-2"><Clock className="w-4 h-4 text-white/40 shrink-0" />{hm(item.start)}–{hm(item.end)}</p>
        {item.meetingPlace && <p className="flex items-start gap-2"><MapPin className="w-4 h-4 text-white/40 shrink-0 mt-0.5" />{item.meetingPlace}</p>}
        {item.price !== undefined && (
          <p className="flex items-center gap-2">
            <span className="w-4 text-center text-white/40 font-bold shrink-0 text-xs">kr</span>
            <span className="font-semibold">{kr(item.price)}/elev</span>
            {item.customPrice && <span className="text-xs text-sky-300">(ert pris)</span>}
          </p>
        )}
        {r?.fillBy && (
          <p className={clsx('flex items-center gap-2', item.deadlinePassed ? 'text-white/40' : 'text-amber-300 font-medium')}>
            <AlarmClock className="w-4 h-4 shrink-0" />
            {item.deadlinePassed ? 'Stängt' : 'Fyll senast'} {new Date(r.fillBy).toLocaleDateString('sv-SE', { day: 'numeric', month: 'long', ...tz })}
          </p>
        )}
      </div>

      {r?.message && (
        <p className="text-sm text-white/80 bg-white/5 rounded-2xl px-4 py-3 whitespace-pre-wrap flex gap-2">
          <MessageSquare className="w-4 h-4 text-white/40 shrink-0 mt-0.5" />{r.message}
        </p>
      )}

      {!item.readOnly && (
        <div>
          {item.myAllocation !== null && (
            <div className="mb-3">
              <div className="flex justify-between text-xs font-semibold text-white/50 mb-1.5">
                <span>Era platser</span>
                <span>{item.students.length} av {item.myAllocation} fyllda</span>
              </div>
              <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                <div className={clsx('h-full rounded-full', item.full ? 'bg-emerald-400' : 'bg-white')} style={{ width: `${Math.min(100, (item.students.length / Math.max(1, item.myAllocation)) * 100)}%` }} />
              </div>
            </div>
          )}
          <Button variant="primary" disabled={item.locked} onClick={onAdd} className="w-full h-12 font-bold">
            <Plus className="w-5 h-5" />
            {item.deadlinePassed ? 'Stängt för nya elever' : item.full ? 'Fullbokat' : 'Lägg till elever'}
          </Button>
        </div>
      )}

      <div>
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-white/50 mb-2">Era elever ({item.students.length})</p>
        {item.students.length === 0 ? (
          <p className="text-sm text-white/40 py-4 text-center">Inga elever bokade på detta pass ännu.</p>
        ) : (
          <ul className="space-y-2">
            {item.students.map((b) => (
              <li key={b.id} className="rounded-2xl bg-white/[0.04] px-4 py-3 flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{b.guestName || '–'}</p>
                  <p className="text-sm font-mono text-white/60">{b.personnummer || '–'}</p>
                  {(b.guestPhone || b.guestEmail?.includes('@')) && (
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-white/50 mt-1">
                      {b.guestPhone && <span className="inline-flex items-center gap-1"><Phone className="w-3 h-3" />{b.guestPhone}</span>}
                      {b.guestEmail?.includes('@') && <span className="inline-flex items-center gap-1 break-all"><Mail className="w-3 h-3 shrink-0" />{b.guestEmail}</span>}
                    </div>
                  )}
                  {b.note && <p className="text-xs text-amber-200 bg-amber-500/10 rounded-lg px-2.5 py-1.5 mt-2 whitespace-pre-wrap">📝 {b.note}</p>}
                </div>
                {onDelete && (
                  <button
                    onClick={() => confirm(`Ta bort ${b.guestName || 'eleven'} från passet?`) && onDelete(b.id)}
                    aria-label={`Ta bort ${b.guestName || 'eleven'}`}
                    className="w-10 h-10 -mr-2 rounded-full text-white/40 hover:text-red-400 hover:bg-red-500/10 flex items-center justify-center shrink-0"
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
