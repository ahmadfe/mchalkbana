'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import AdminShell from '@/components/admin/AdminShell';
import StudentForm, { emptyStudent, type StudentFormValues } from '@/components/admin/StudentForm';
import { Button } from '@/components/admin/ui';

export default function NyElevPage() {
  const locale = useLocale();
  const router = useRouter();
  const [values, setValues] = useState<StudentFormValues>(emptyStudent);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<{ message: string; existingId?: number } | null>(null);

  const missing = !values.firstName.trim() || !values.lastName.trim() || !values.personnummer.trim() || !values.email.trim() || !values.phone.trim();

  const save = async () => {
    setSaving(true);
    setError(null);
    const res = await fetch('/api/admin/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError({ message: data.error ?? 'Något gick fel', existingId: data.existingId }); return; }
    router.push(`/${locale}/admin/elever/${data.student.id}`);
  };

  return (
    <AdminShell title="Ny elev" back={{ href: '/admin/elever', label: 'Elever' }}>
      <StudentForm values={values} onChange={setValues} preselectFilial />

      <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-3 mt-6">
        {error && (
          <p className="text-sm text-red-400 sm:mr-auto">
            {error.message}
            {error.existingId && (
              <> – <Link href={`/${locale}/admin/elever/${error.existingId}`} className="underline">öppna eleven</Link></>
            )}
          </p>
        )}
        <Button onClick={() => router.push(`/${locale}/admin/elever`)}>Avbryt</Button>
        <Button variant="primary" onClick={save} disabled={saving || missing}>
          {saving ? 'Sparar…' : 'Skapa elev'}
        </Button>
      </div>
    </AdminShell>
  );
}
