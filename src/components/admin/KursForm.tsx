'use client';

import { useEffect, useState } from 'react';
import { courseKind } from '@/lib/courseKind';
import { Card, Checkbox, Field, Input, Select, Textarea } from './ui';

export interface KursFormValues {
  courseId: string;
  schoolId: string;
  date: string;
  start: string;
  end: string;
  instructorIds: number[];
  seatLimit: string;
  discountPrice: string;
  selfBooking: boolean;
  reportToTS: boolean;
  internalNotes: string;
  receiptMessage: string;
  comboRisk1SessionId: string;
  comboRisk2SessionId: string;
}

export function emptyKurs(): KursFormValues {
  return {
    courseId: '', schoolId: '', date: new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' }),
    start: '09:00', end: '13:00', instructorIds: [], seatLimit: '8', discountPrice: '',
    selfBooking: true, reportToTS: true, internalNotes: '', receiptMessage: '',
    comboRisk1SessionId: '', comboRisk2SessionId: '',
  };
}

/** Formulärvärden → API-kropp. Tiderna tolkas i webbläsarens tidszon (Sverige). */
export function kursPayload(v: KursFormValues) {
  return {
    courseId: v.courseId,
    schoolId: v.schoolId,
    startTime: new Date(`${v.date}T${v.start}`).toISOString(),
    endTime: new Date(`${v.date}T${v.end}`).toISOString(),
    instructorIds: v.instructorIds,
    seatLimit: Number(v.seatLimit),
    discountPrice: v.discountPrice,
    selfBooking: v.selfBooking,
    reportToTS: v.reportToTS,
    internalNotes: v.internalNotes,
    receiptMessage: v.receiptMessage,
    comboRisk1SessionId: v.comboRisk1SessionId,
    comboRisk2SessionId: v.comboRisk2SessionId,
  };
}

interface Course { id: number; titleSv: string; type: string; price: number; location: string; behorighet: string }
interface Filial { id: number; name: string; active: boolean }
interface Instructor { id: number; name: string }
interface SessionOption { id: number; startTime: string; title: string; courseType: string }

export default function KursForm({ values, onChange, isNew }: { values: KursFormValues; onChange: (v: KursFormValues) => void; isNew: boolean }) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [filialer, setFilialer] = useState<Filial[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [upcoming, setUpcoming] = useState<SessionOption[]>([]);

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/courses').then(r => r.json()),
      fetch('/api/admin/filialer').then(r => r.json()),
      fetch('/api/admin/instructors').then(r => r.json()),
      fetch('/api/admin/kurser?view=upcoming').then(r => r.json()),
    ]).then(([c, f, i, k]) => {
      setCourses(c.courses ?? []);
      setFilialer(f.filialer ?? []);
      setInstructors(i.instructors ?? []);
      setUpcoming(k.kurser ?? []);
    });
  }, []);

  // Ny kurs: förvälj första kursslag och första aktiva filial
  useEffect(() => {
    if (!isNew || courses.length === 0 || filialer.length === 0) return;
    if (values.courseId && values.schoolId) return;
    onChange({
      ...values,
      courseId: values.courseId || String(courses[0].id),
      schoolId: values.schoolId || String((filialer.find(f => f.active) ?? filialer[0]).id),
    });
  }, [courses, filialer]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = <K extends keyof KursFormValues>(k: K, v: KursFormValues[K]) => onChange({ ...values, [k]: v });
  const text = (k: keyof KursFormValues) => ({
    value: values[k] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => set(k, e.target.value),
  });

  const course = courses.find(c => String(c.id) === values.courseId);
  const isKombo = course ? courseKind(course.type) === 'kombo' : false;
  const options = (kind: 'risk1' | 'risk2') => upcoming.filter(s => courseKind(s.courseType) === kind);
  const fmt = (iso: string) => new Date(iso).toLocaleString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Stockholm' });

  return (
    <div className="grid lg:grid-cols-2 gap-4 items-start">
      <div className="space-y-4">
        <Card title="Kursen">
          <div className="space-y-4">
            <Field label="Kursslag" hint={course ? `${course.behorighet} · ordinarie pris ${course.price.toLocaleString('sv-SE')} kr${course.location ? ` · ${course.location}` : ''}` : undefined}>
              <Select key={`c${courses.length}`} {...text('courseId')}>
                {courses.length === 0 && <option value="">Laddar…</option>}
                {courses.map(c => <option key={c.id} value={c.id}>{c.titleSv}</option>)}
              </Select>
            </Field>
            <Field label="Filial">
              <Select key={`f${filialer.length}`} {...text('schoolId')}>
                {filialer.length === 0 && <option value="">Laddar…</option>}
                {filialer.filter(f => f.active || String(f.id) === values.schoolId).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </Select>
            </Field>
            {isKombo && (
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Risk 1-tillfälle">
                  <Select key={`r1${upcoming.length}`} {...text('comboRisk1SessionId')}>
                    <option value="">Inget valt</option>
                    {options('risk1').map(s => <option key={s.id} value={s.id}>{fmt(s.startTime)}</option>)}
                  </Select>
                </Field>
                <Field label="Risk 2-tillfälle">
                  <Select key={`r2${upcoming.length}`} {...text('comboRisk2SessionId')}>
                    <option value="">Inget valt</option>
                    {options('risk2').map(s => <option key={s.id} value={s.id}>{fmt(s.startTime)}</option>)}
                  </Select>
                </Field>
              </div>
            )}
            <Field label="Meddelande i bokningsbekräftelsen" hint="Lämna tomt för att använda kursslagets meddelande.">
              <Textarea {...text('receiptMessage')} placeholder="T.ex. vad eleven ska ta med" />
            </Field>
          </div>
        </Card>
      </div>

      <div className="space-y-4">
        <Card title="Tid och lärare">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Datum" className="col-span-2"><Input type="date" {...text('date')} /></Field>
            <Field label="Start"><Input type="time" {...text('start')} /></Field>
            <Field label="Slut"><Input type="time" {...text('end')} /></Field>
          </div>
          <div className="mt-5">
            <span className="block text-sm font-semibold text-white/80 mb-2">Ansvariga lärare</span>
            {instructors.length === 0 ? (
              <p className="text-sm text-white/50">Inga lärarkonton än – bjud in lärare under Övrig admin → Instruktörer.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {instructors.map(i => {
                  const on = values.instructorIds.includes(i.id);
                  return (
                    <button
                      key={i.id}
                      type="button"
                      onClick={() => set('instructorIds', on ? values.instructorIds.filter(x => x !== i.id) : [...values.instructorIds, i.id])}
                      className={on
                        ? 'h-10 px-4 rounded-full text-sm font-semibold bg-white text-black'
                        : 'h-10 px-4 rounded-full text-sm font-semibold bg-white/5 text-white/70 border border-white/10 hover:bg-white/10'}
                    >
                      {i.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </Card>

        <Card title="Platser och pris">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Antal platser"><Input type="number" min={1} {...text('seatLimit')} /></Field>
            <Field label="Kampanjpris (kr)" hint="Valfritt. Visas överstruket mot ordinarie pris.">
              <Input type="number" min={0} {...text('discountPrice')} placeholder={course ? String(course.price) : ''} />
            </Field>
          </div>
          <div className="space-y-4 mt-5">
            <div>
              <Checkbox checked={values.selfBooking} onChange={v => set('selfBooking', v)}>Eleverna får anmäla sig själva</Checkbox>
              <p className="text-sm text-white/50 mt-1.5 ml-9">Kursen syns på webbplatsen och går att boka. Annars kan bara ni och tilldelade trafikskolor anmäla elever.</p>
            </div>
            <Checkbox checked={values.reportToTS} onChange={v => set('reportToTS', v)}>Rapporteras till Transportstyrelsen efteråt</Checkbox>
            <Field label="Interna anteckningar"><Textarea {...text('internalNotes')} placeholder="Syns inte för eleverna" /></Field>
          </div>
        </Card>
      </div>
    </div>
  );
}
