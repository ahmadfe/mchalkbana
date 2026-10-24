'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import AdminShell from '@/components/admin/AdminShell';
import { Badge, Button, Card, Field, Input } from '@/components/admin/ui';

interface Filial {
  id: number;
  name: string;
  address: string;
  city: string;
  bana: string;
  contactEmail: string;
  active: boolean;
  _count: { students: number; sessions: number };
}

type Draft = Pick<Filial, 'name' | 'address' | 'city' | 'bana' | 'contactEmail'>;
const emptyDraft: Draft = { name: '', address: '', city: '', bana: '', contactEmail: '' };

export default function FilialerPage() {
  const [filialer, setFilialer] = useState<Filial[] | null>(null);
  const [editing, setEditing] = useState<number | 'new' | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    fetch('/api/admin/filialer').then(r => r.json()).then(d => setFilialer(d.filialer ?? []));
  }, []);
  useEffect(load, [load]);

  const startEdit = (f: Filial | null) => {
    setError('');
    setEditing(f ? f.id : 'new');
    setDraft(f ? { name: f.name, address: f.address, city: f.city, bana: f.bana, contactEmail: f.contactEmail } : emptyDraft);
  };

  const save = async () => {
    setSaving(true);
    setError('');
    const res = await fetch(editing === 'new' ? '/api/admin/filialer' : `/api/admin/filialer/${editing}`, {
      method: editing === 'new' ? 'POST' : 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.error ?? 'Något gick fel'); return; }
    setEditing(null);
    load();
  };

  const toggleActive = async (f: Filial) => {
    await fetch(`/api/admin/filialer/${f.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !f.active }),
    });
    load();
  };

  const form = (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Namn" required><Input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder="T.ex. Uppsala Halkbana Alunda" /></Field>
        <Field label="Kontakt-e-post"><Input type="email" value={draft.contactEmail} onChange={e => setDraft({ ...draft, contactEmail: e.target.value })} /></Field>
        <Field label="Adress" required><Input value={draft.address} onChange={e => setDraft({ ...draft, address: e.target.value })} /></Field>
        <Field label="Ort"><Input value={draft.city} onChange={e => setDraft({ ...draft, city: e.target.value })} /></Field>
        <Field label="Bana" className="sm:col-span-2" hint="Banans namn som det står i rapporten till Transportstyrelsen, t.ex. Lilla trafikövningsplatsen.">
          <Input value={draft.bana} onChange={e => setDraft({ ...draft, bana: e.target.value })} />
        </Field>
      </div>
      <div className="flex items-center justify-end gap-3">
        {error && <p className="text-sm text-red-400 mr-auto">{error}</p>}
        <Button onClick={() => setEditing(null)}>Avbryt</Button>
        <Button variant="primary" onClick={save} disabled={saving || !draft.name.trim() || !draft.address.trim()}>
          {saving ? 'Sparar…' : editing === 'new' ? 'Lägg till filial' : 'Spara'}
        </Button>
      </div>
    </div>
  );

  return (
    <AdminShell
      title="Filialer"
      actions={editing !== 'new' && <Button variant="primary" onClick={() => startEdit(null)}><Plus className="w-4 h-4" /> Ny filial</Button>}
    >
      <p className="text-white/60 mb-6 max-w-2xl">
        Platserna där ni håller kurser. Varje kurs och elev hör till en filial. En inaktiv filial går inte att välja för nya kurser men finns kvar i historiken.
      </p>

      {editing === 'new' && <Card title="Ny filial" className="mb-4">{form}</Card>}

      {filialer === null ? (
        <div className="py-20 flex justify-center"><div className="w-6 h-6 border-2 border-white/50 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="space-y-3">
          {filialer.map(f => editing === f.id ? (
            <Card key={f.id} title={`Redigera ${f.name}`}>{form}</Card>
          ) : (
            <div key={f.id} className="rounded-3xl bg-[#1c1c1f] p-5 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold">{f.name}</span>
                  {!f.active && <Badge>Inaktiv</Badge>}
                </div>
                <p className="text-sm text-white/50 mt-0.5">{[f.address, f.city, f.contactEmail].filter(Boolean).join(' · ')}</p>
                <p className={f.bana ? 'text-sm text-white/50 mt-0.5' : 'text-sm text-amber-300/90 mt-0.5'}>{f.bana ? `Bana: ${f.bana}` : 'Bana saknas – behövs för rapporten till Transportstyrelsen'}</p>
                <p className="text-sm text-white/40 mt-0.5">{f._count.students} elever · {f._count.sessions} kurstillfällen</p>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => toggleActive(f)}>{f.active ? 'Inaktivera' : 'Aktivera'}</Button>
                <Button onClick={() => startEdit(f)}>Redigera</Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminShell>
  );
}
