'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import AdminShell from '@/components/admin/AdminShell';
import KursForm, { emptyKurs, kursPayload, type KursFormValues } from '@/components/admin/KursForm';
import { Button } from '@/components/admin/ui';

export default function NyKursPage() {
  const locale = useLocale();
  const router = useRouter();
  const [values, setValues] = useState<KursFormValues>(emptyKurs);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    setSaving(true);
    setError('');
    const res = await fetch('/api/admin/kurser', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(kursPayload(values)),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.error ?? 'Något gick fel'); return; }
    router.push(`/${locale}/admin/kurser/${data.id}`);
  };

  return (
    <AdminShell title="Ny kurs" back={{ href: '/admin/kurser', label: 'Kurser' }}>
      <KursForm values={values} onChange={setValues} isNew />
      <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-3 mt-6">
        {error && <p className="text-sm text-red-400 sm:mr-auto">{error}</p>}
        <Button onClick={() => router.push(`/${locale}/admin/kurser`)}>Avbryt</Button>
        <Button variant="primary" onClick={save} disabled={saving || !values.courseId || !values.schoolId}>
          {saving ? 'Skapar…' : 'Skapa kurs'}
        </Button>
      </div>
    </AdminShell>
  );
}
