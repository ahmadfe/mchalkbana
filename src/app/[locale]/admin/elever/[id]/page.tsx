'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { Trash2 } from 'lucide-react';
import AdminShell from '@/components/admin/AdminShell';
import StudentForm, { type StudentFormValues } from '@/components/admin/StudentForm';
import { Badge, Button, Card, formatDate } from '@/components/admin/ui';
import type { StudentDto } from '@/lib/students';

interface BookingRow {
  id: number;
  startTime: string;
  endTime: string;
  courseTitle: string;
  filialName: string;
  status: string;
  attendance: string;
  result: string | null;
  checkedInAt: string | null;
  checkedInBy: string | null;
  idType: string | null;
}

const ID_LABELS: Record<string, string> = {
  korkort: 'Körkort', pass: 'Pass', nationellt_id: 'Nationellt id-kort', id_kort: 'Id-kort (godkänt)',
};
const ATTENDANCE: Record<string, { label: string; tone: 'green' | 'red' | 'amber' }> = {
  attended: { label: 'Deltog', tone: 'green' },
  no_show: { label: 'Uteblev', tone: 'red' },
  late_cancel: { label: 'Sen avanmälan', tone: 'amber' },
};

function toForm(s: StudentDto): StudentFormValues {
  return {
    firstName: s.firstName, lastName: s.lastName, personnummer: s.personnummer, email: s.email, phone: s.phone,
    address: s.address, postalCode: s.postalCode, city: s.city, behorighet: s.behorighet, status: s.status,
    filialId: s.filialId ? String(s.filialId) : '', permitValidUntil: s.permitValidUntil, synintygDate: s.synintygDate,
    risk1DoneAt: s.risk1DoneAt, risk2DoneAt: s.risk2DoneAt, gdprInformed: s.gdprInformed, notes: s.notes,
  };
}

export default function ElevPage({ params }: { params: { id: string } }) {
  const locale = useLocale();
  const router = useRouter();
  const [student, setStudent] = useState<StudentDto | null>(null);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [values, setValues] = useState<StudentFormValues | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [archived, setArchived] = useState<'active' | 'archived' | 'done'>('active');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/students/${params.id}`);
    if (!res.ok) { setNotFound(true); return; }
    const data = await res.json();
    setStudent(data.student);
    setBookings(data.bookings);
    setArchived(data.archiveState);
    setValues(toForm(data.student));
  }, [params.id]);

  useEffect(() => { load(); }, [load]);

  const dirty = !!student && !!values && JSON.stringify(values) !== JSON.stringify(toForm(student));

  const save = async () => {
    if (!values) return;
    setSaving(true);
    setMessage(null);
    const res = await fetch(`/api/admin/students/${params.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setMessage({ ok: false, text: data.error ?? 'Något gick fel' }); return; }
    setStudent(data.student);
    setValues(toForm(data.student));
    setMessage({ ok: true, text: 'Sparat' });
  };

  const remove = async () => {
    if (!student) return;
    if (!confirm(`Radera ${student.name} ur elevregistret?\n\nBokningarna och riskregistret finns kvar, men kopplas loss från eleven.`)) return;
    const res = await fetch(`/api/admin/students/${params.id}`, { method: 'DELETE' });
    if (res.ok) router.push(`/${locale}/admin/elever`);
  };

  if (notFound) {
    return (
      <AdminShell title="Eleven hittades inte" back={{ href: '/admin/elever', label: 'Elever' }}>
        <p className="text-white/50">Eleven finns inte eller har raderats.</p>
      </AdminShell>
    );
  }

  if (!student || !values) {
    return (
      <AdminShell title="Elev" back={{ href: '/admin/elever', label: 'Elever' }}>
        <div className="py-20 flex justify-center"><div className="w-6 h-6 border-2 border-white/50 border-t-transparent rounded-full animate-spin" /></div>
      </AdminShell>
    );
  }

  const [datePart, lastFour] = student.personnummer ? student.personnummer.split('-') : ['', ''];

  return (
    <AdminShell
      title={student.name || 'Elev'}
      back={{ href: '/admin/elever', label: 'Elever' }}
      actions={<Button variant="danger" onClick={remove}><Trash2 className="w-4 h-4" /> Radera</Button>}
    >
      <div className="grid sm:grid-cols-3 gap-4 mb-4">
        <div className="rounded-3xl bg-[#1c1c1f] p-5">
          <p className="font-mono text-2xl font-bold tracking-wide">
            {datePart || '–'}<span className="text-white/50 font-normal">{lastFour ? `–${lastFour}` : ''}</span>
          </p>
          <p className="text-sm text-white/50 mt-1">Personnummer{student.age !== null ? ` · ${student.age} år` : ''}</p>
        </div>
        <Milestone label="Riskutbildning del 1" date={student.risk1DoneAt} />
        <Milestone label="Riskutbildning del 2" date={student.risk2DoneAt} />
      </div>

      {archived === 'done' && (
        <p className="rounded-2xl bg-sky-500/10 text-sky-200 text-sm px-4 py-3 mb-4">
          Eleven ligger under Arkiverade eftersom alla kurser är genomförda. Bokas eleven på en ny kurs blir den aktiv igen.
        </p>
      )}

      <Card title="Kurser" className="mb-4">
        {bookings.length === 0 ? (
          <p className="text-sm text-white/50">Eleven har inte varit anmäld till någon kurs.</p>
        ) : (
          <div className="divide-y divide-white/5 -my-3">
            {bookings.map(b => (
              <div key={b.id} className="py-3 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold truncate">{b.courseTitle}</p>
                  <p className="text-sm text-white/50">
                    {formatDate(b.startTime, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                    {' · '}
                    {new Date(b.startTime).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Stockholm' })}
                    {' · '}{b.filialName}
                  </p>
                  {b.checkedInAt && (
                    <p className="text-sm text-emerald-300/80 mt-0.5">
                      Incheckad {formatDate(b.checkedInAt)}{b.idType ? ` med ${ID_LABELS[b.idType]?.toLowerCase() ?? b.idType}` : ''}{b.checkedInBy ? ` av ${b.checkedInBy}` : ''}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {b.status === 'Canceled' ? <Badge tone="red">Avbokad</Badge>
                    : b.status === 'Paid' ? <Badge tone="green">Betald</Badge>
                    : b.status === 'Pending' ? <Badge tone="amber">Inte betald</Badge>
                    : <Badge>Bekräftad</Badge>}
                  {ATTENDANCE[b.attendance] && <Badge tone={ATTENDANCE[b.attendance].tone}>{ATTENDANCE[b.attendance].label}</Badge>}
                  {b.result === 'passed' && <Badge tone="blue">Godkänd</Badge>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <StudentForm values={values} onChange={v => { setValues(v); setMessage(null); }} />

      {(dirty || message) && (
        <div className="sticky bottom-4 mt-6 rounded-2xl bg-[#26262a] border border-white/10 shadow-2xl px-4 py-3 flex items-center justify-end gap-3">
          {message
            ? <p className={message.ok ? 'text-sm text-emerald-300 mr-auto' : 'text-sm text-red-400 mr-auto'}>{message.text}</p>
            : <p className="text-sm text-white/60 mr-auto">Osparade ändringar</p>}
          {dirty && <Button onClick={() => { setValues(toForm(student)); setMessage(null); }} disabled={saving}>Ångra</Button>}
          {dirty && <Button variant="primary" onClick={save} disabled={saving}>{saving ? 'Sparar…' : 'Spara ändringar'}</Button>}
        </div>
      )}
    </AdminShell>
  );
}

function Milestone({ label, date }: { label: string; date: string }) {
  return (
    <div className="rounded-3xl bg-[#1c1c1f] p-5">
      <p className={date ? 'text-2xl font-bold text-emerald-300' : 'text-2xl font-bold text-white/30'}>
        {date ? formatDate(date) : 'Ej gjord'}
      </p>
      <p className="text-sm text-white/50 mt-1">{label}</p>
    </div>
  );
}
