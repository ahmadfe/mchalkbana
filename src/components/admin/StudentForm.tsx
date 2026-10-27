'use client';

import { useEffect, useState } from 'react';
import { Card, Checkbox, Field, Input, Select, Textarea } from './ui';

export interface StudentFormValues {
  firstName: string;
  lastName: string;
  personnummer: string;
  email: string;
  phone: string;
  address: string;
  postalCode: string;
  city: string;
  behorighet: string;
  status: string;
  filialId: string;
  permitValidUntil: string;
  synintygDate: string;
  risk1DoneAt: string;
  risk2DoneAt: string;
  gdprInformed: boolean;
  notes: string;
}

export const emptyStudent: StudentFormValues = {
  firstName: '', lastName: '', personnummer: '', email: '', phone: '',
  address: '', postalCode: '', city: '', behorighet: 'B', status: 'active', filialId: '',
  permitValidUntil: '', synintygDate: '', risk1DoneAt: '', risk2DoneAt: '',
  gdprInformed: false, notes: '',
};

const BEHORIGHETER = ['B', 'A', 'A2', 'A1', 'AM', 'BE', 'C', 'D'];

interface Filial { id: number; name: string; active: boolean }

export default function StudentForm({
  values,
  onChange,
  preselectFilial = false,
}: {
  values: StudentFormValues;
  onChange: (v: StudentFormValues) => void;
  preselectFilial?: boolean;
}) {
  const [filialer, setFilialer] = useState<Filial[]>([]);

  useEffect(() => {
    fetch('/api/admin/filialer').then(r => r.json()).then(d => setFilialer(d.filialer ?? []));
  }, []);

  // Förvälj första filialen för nya elever
  useEffect(() => {
    if (preselectFilial && !values.filialId && filialer.length > 0) onChange({ ...values, filialId: String(filialer.find(f => f.active)?.id ?? filialer[0].id) });
  }, [filialer]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = <K extends keyof StudentFormValues>(k: K, v: StudentFormValues[K]) => onChange({ ...values, [k]: v });
  const text = (k: keyof StudentFormValues) => ({
    value: values[k] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => set(k, e.target.value),
  });

  return (
    <div className="grid lg:grid-cols-2 gap-4 items-start">
      <div className="space-y-4">
        <Card title="Person">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Förnamn" required><Input {...text('firstName')} autoComplete="off" /></Field>
            <Field label="Efternamn" required><Input {...text('lastName')} autoComplete="off" /></Field>
            <Field
              label="Personnummer"
              required
              className="sm:col-span-2"
              hint="Behövs för rapportering till Transportstyrelsen och för att identifiera eleven vid kursen. Lagras krypterat."
            >
              <Input {...text('personnummer')} placeholder="ÅÅÅÅMMDD-XXXX" inputMode="numeric" autoComplete="off" />
            </Field>
          </div>
        </Card>

        <Card title="Kontakt">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="E-post" required className="sm:col-span-2"><Input {...text('email')} type="email" /></Field>
            <Field label="Telefon" required className="sm:col-span-2"><Input {...text('phone')} type="tel" /></Field>
            <Field label="Adress" className="sm:col-span-2"><Input {...text('address')} /></Field>
            <Field label="Postnummer"><Input {...text('postalCode')} inputMode="numeric" /></Field>
            <Field label="Ort"><Input {...text('city')} /></Field>
          </div>
        </Card>
      </div>

      <div className="space-y-4">
        <Card title="Utbildning">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Status">
              <Select {...text('status')}>
                <option value="active">Aktiv</option>
                <option value="archived">Arkiverad</option>
              </Select>
            </Field>
            <Field label="Filial">
              {/* key: rita om när filialerna laddats, annars visas inte det valda värdet */}
              <Select key={filialer.length} {...text('filialId')}>
                <option value="">Ingen</option>
                {filialer.map(f => (
                  <option key={f.id} value={f.id}>{f.name}{f.active ? '' : ' (inaktiv)'}</option>
                ))}
              </Select>
            </Field>
            <Field label="Behörighet">
              <Select {...text('behorighet')}>
                {BEHORIGHETER.map(b => <option key={b} value={b}>{b}</option>)}
              </Select>
            </Field>
            <div className="hidden sm:block" />
            <Field label="Riskutbildning del 1 gjord"><Input {...text('risk1DoneAt')} type="date" /></Field>
            <Field label="Riskutbildning del 2 gjord"><Input {...text('risk2DoneAt')} type="date" /></Field>
          </div>
          <p className="text-sm text-white/50 mt-3 leading-relaxed">
            Lämna tomt om eleven inte gjort dem än – datumen fylls i automatiskt när eleven checkas in på en riskutbildning.
          </p>
        </Card>

        <Card title="Övrigt">
          <div className="space-y-5">
            <Checkbox checked={values.gdprInformed} onChange={v => set('gdprInformed', v)}>
              Eleven har fått information om hur personuppgifterna behandlas (GDPR)
            </Checkbox>
            <Field label="Interna anteckningar">
              <Textarea {...text('notes')} placeholder="Syns inte för eleven" />
            </Field>
          </div>
        </Card>
      </div>
    </div>
  );
}
