'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import AdminShell from '@/components/admin/AdminShell';
import KursForm, { kursPayload, type KursFormValues } from '@/components/admin/KursForm';
import { Button } from '@/components/admin/ui';

const local = (iso: string) => {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' }),
    time: d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Stockholm' }),
  };
};

export default function RedigeraKursPage({ params }: { params: { id: string } }) {
  const locale = useLocale();
  const router = useRouter();
  const [values, setValues] = useState<KursFormValues | null>(null);
  const [title, setTitle] = useState('Redigera kurs');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const back = `/admin/kurser/${params.id}`;

  useEffect(() => {
    fetch(`/api/admin/kurser/${params.id}`).then(r => r.json()).then(({ kurs }) => {
      if (!kurs) return;
      setTitle(kurs.title);
      const s = local(kurs.startTime);
      setValues({
        courseId: String(kurs.courseId),
        schoolId: String(kurs.filial.id),
        date: s.date,
        start: s.time,
        end: local(kurs.endTime).time,
        instructorIds: kurs.instructors.map((i: { id: number }) => i.id),
        seatLimit: String(kurs.seatLimit),
        discountPrice: kurs.discountPrice === null ? '' : String(kurs.discountPrice),
        selfBooking: kurs.selfBooking,
        reportToTS: kurs.reportToTS,
        internalNotes: kurs.internalNotes,
        receiptMessage: kurs.receiptMessage,
        comboRisk1SessionId: kurs.comboRisk1Session ? String(kurs.comboRisk1Session.id) : '',
        comboRisk2SessionId: kurs.comboRisk2Session ? String(kurs.comboRisk2Session.id) : '',
      });
    });
  }, [params.id]);

  const save = async () => {
    if (!values) return;
    setSaving(true);
    setError('');
    const res = await fetch(`/api/admin/kurser/${params.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(kursPayload(values)),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.error ?? 'Något gick fel'); return; }
    router.push(`/${locale}${back}`);
  };

  return (
    <AdminShell title={title} back={{ href: back, label: 'Tillbaka till kursen' }}>
      {!values ? (
        <div className="py-20 flex justify-center"><div className="w-6 h-6 border-2 border-white/50 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <>
          <KursForm values={values} onChange={setValues} isNew={false} />
          <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-3 mt-6">
            {error && <p className="text-sm text-red-400 sm:mr-auto">{error}</p>}
            <Button onClick={() => router.push(`/${locale}${back}`)}>Avbryt</Button>
            <Button variant="primary" onClick={save} disabled={saving}>{saving ? 'Sparar…' : 'Spara ändringar'}</Button>
          </div>
        </>
      )}
    </AdminShell>
  );
}
