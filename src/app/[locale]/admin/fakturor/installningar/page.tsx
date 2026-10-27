'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import AdminShell from '@/components/admin/AdminShell';
import { Button, Card, Checkbox, Field, Input, Textarea } from '@/components/admin/ui';

interface Company {
  name: string; address: string; orgNr: string; vatNr: string; bankgiro: string; plusgiro: string; iban: string;
  email: string; phone: string; paymentDays: number | string; firstNumber: number | string; fSkatt: boolean; startPeriod: string;
  sieAccounts: { receivable: string; sales: string; vat: string; bank: string };
}

export default function FakturaInstallningarPage() {
  const locale = useLocale();
  const router = useRouter();
  const [c, setC] = useState<Company | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/admin/fakturor/installningar').then(r => r.json()).then(d => setC(d.company));
  }, []);

  const save = async () => {
    if (!c) return;
    setSaving(true);
    setError('');
    const res = await fetch('/api/admin/fakturor/installningar', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(c),
    });
    setSaving(false);
    if (!res.ok) { setError((await res.json()).error ?? 'Något gick fel'); return; }
    router.push(`/${locale}/admin/fakturor`);
  };

  const back = { href: '/admin/fakturor', label: 'Fakturor' };
  if (!c) {
    return (
      <AdminShell title="Fakturainställningar" back={back}>
        <div className="py-20 flex justify-center"><div className="w-6 h-6 border-2 border-white/50 border-t-transparent rounded-full animate-spin" /></div>
      </AdminShell>
    );
  }

  const text = (k: keyof Company) => ({
    value: String(c[k] ?? ''),
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setC({ ...c, [k]: e.target.value }),
  });

  return (
    <AdminShell
      title="Fakturainställningar"
      back={back}
      actions={<Button variant="primary" onClick={save} disabled={saving}>{saving ? 'Sparar…' : 'Spara'}</Button>}
    >
      <p className="text-sm text-white/60 -mt-4 mb-6">Uppgifterna skrivs ut på varje ny faktura. Fakturor som redan skapats ändras inte.</p>
      <div className="grid lg:grid-cols-2 gap-4 items-start">
        <div className="space-y-4">
          <Card title="Företaget">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Företagsnamn" required className="sm:col-span-2"><Input {...text('name')} /></Field>
              <Field label="Adress" className="sm:col-span-2"><Textarea {...text('address')} placeholder={'Gatan 1\n123 45 Ort'} /></Field>
              <Field label="Organisationsnummer"><Input {...text('orgNr')} placeholder="556677-8899" /></Field>
              <Field label="Momsregistreringsnummer"><Input {...text('vatNr')} placeholder="SE556677889901" /></Field>
              <Field label="E-post"><Input type="email" {...text('email')} /></Field>
              <Field label="Telefon"><Input type="tel" {...text('phone')} /></Field>
            </div>
            <div className="mt-5">
              <Checkbox checked={c.fSkatt} onChange={v => setC({ ...c, fSkatt: v })}>Godkänd för F-skatt (skrivs ut på fakturan)</Checkbox>
            </div>
          </Card>
        </div>
        <div className="space-y-4">
          <Card title="Betalning">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Bankgiro"><Input {...text('bankgiro')} placeholder="123-4567" /></Field>
              <Field label="Plusgiro"><Input {...text('plusgiro')} /></Field>
              <Field label="IBAN" className="sm:col-span-2"><Input {...text('iban')} placeholder="SE00 0000 0000 0000 0000 0000" /></Field>
              <Field label="Betalningsvillkor (dagar)"><Input type="number" min={0} max={120} {...text('paymentDays')} /></Field>
              <Field label="Första fakturanummer" hint="Används bara tills den första fakturan har skapats."><Input type="number" min={1} {...text('firstNumber')} /></Field>
            </div>
          </Card>
          <Card title="Start">
            <Field
              label="Fakturera kurser från och med"
              hint="Skolornas elever på kurser före den här månaden räknas som redan fakturerade (med det gamla e-postutskicket) och visas inte under Att skicka."
            >
              <Input type="month" {...text('startPeriod')} />
            </Field>
          </Card>
          <Card title="Bokföring (SIE)">
            <div className="grid grid-cols-2 gap-4">
              {([['receivable', 'Kundfordringar'], ['sales', 'Försäljning 25 % moms'], ['vat', 'Utgående moms 25 %'], ['bank', 'Bank (betalningar)']] as const).map(([k, label]) => (
                <Field key={k} label={label}>
                  <Input
                    inputMode="numeric"
                    value={c.sieAccounts[k]}
                    onChange={e => setC({ ...c, sieAccounts: { ...c.sieAccounts, [k]: e.target.value } })}
                  />
                </Field>
              ))}
            </div>
            <p className="text-sm text-white/50 mt-3">Kontona enligt BAS-kontoplanen. Ändra bara om er redovisningskonsult använder andra konton.</p>
          </Card>
          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>
      </div>
    </AdminShell>
  );
}
