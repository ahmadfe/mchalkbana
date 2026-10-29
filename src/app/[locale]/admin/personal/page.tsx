'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { Copy, KeyRound, Pencil, Plus, Power, Trash2, X } from 'lucide-react';
import clsx from 'clsx';
import AdminShell from '@/components/admin/AdminShell';
import { Badge, Button, Field, Input, Select, formatDate } from '@/components/admin/ui';
import { useAuth } from '@/context/AuthContext';
import { isOwner } from '@/lib/owner';

type Role = 'admin' | 'instructor' | 'school';
interface Account {
  id: number; name: string; email: string; phone: string | null; role: Role; disabled: boolean; createdAt: string;
  superUser: boolean; isMe: boolean; canManage: boolean; upcomingCourses?: number; hasHistory?: boolean;
}

const TABS: [Role, string][] = [['admin', 'Admins'], ['instructor', 'Instruktörer'], ['school', 'Trafikskolor']];
const ROLE_LABEL: Record<Role, string> = { admin: 'Administratör', instructor: 'Instruktör', school: 'Trafikskola' };

export default function PersonalPage() {
  const locale = useLocale();
  const { user } = useAuth();
  const owner = isOwner(user);
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [tab, setTab] = useState<Role>('instructor');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [password, setPassword] = useState<{ name: string; email: string; password: string; fresh: boolean } | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => fetch('/api/admin/personal').then(r => r.json()).then(d => setAccounts(d.accounts ?? [])), []);
  useEffect(() => { load(); }, [load]);

  // ?tab=school&new=1 från Trafikskolor-sidan
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const t = q.get('tab');
    if (t === 'admin' || t === 'instructor' || t === 'school') setTab(t);
    if (q.get('new')) setCreating(true);
  }, []);

  const call = async (a: Account, method: 'PATCH' | 'DELETE', body?: object) => {
    setError('');
    const res = await fetch(`/api/admin/personal/${a.id}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? 'Något gick fel'); return null; }
    load();
    return data;
  };

  const resetPassword = async (a: Account) => {
    if (!confirm(`Skapa ett nytt lösenord för ${a.name}? Det gamla slutar fungera och det nya mejlas till ${a.email}.`)) return;
    const data = await call(a, 'PATCH', { resetPassword: true });
    if (data?.password) setPassword({ name: a.name, email: a.email, password: data.password, fresh: false });
  };
  const toggleDisabled = async (a: Account) => {
    if (!a.disabled && !confirm(`Inaktivera ${a.name}? Kontot kan inte logga in längre, men all historik och alla fakturor finns kvar.`)) return;
    await call(a, 'PATCH', { disabled: !a.disabled });
  };
  const remove = async (a: Account) => {
    if (!confirm(`Ta bort ${a.name}? Det går inte att ångra.`)) return;
    await call(a, 'DELETE');
  };

  const list = (accounts ?? []).filter(a => a.role === tab);
  const count = (r: Role) => (accounts ?? []).filter(a => a.role === r).length;

  return (
    <AdminShell title="Personal" actions={<Button variant="primary" onClick={() => setCreating(true)}><Plus className="w-4 h-4" /> <span className="hidden sm:inline">Nytt konto</span></Button>}>
      <p className="text-sm text-white/60 -mt-4 mb-6">Konton för administratörer, instruktörer och trafikskolor. Lösenord skapas automatiskt och mejlas till personen.</p>

      <div className="flex p-1 rounded-2xl bg-[#1c1c1f] mb-5 sm:max-w-lg">
        {TABS.map(([r, label]) => (
          <button
            key={r}
            onClick={() => setTab(r)}
            className={clsx('flex-1 h-10 rounded-xl text-sm font-semibold transition', tab === r ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white')}
          >
            {label}{accounts ? ` (${count(r)})` : ''}
          </button>
        ))}
      </div>

      {tab === 'admin' && !owner && (
        <p className="text-sm text-white/50 mb-4">Bara superanvändaren kan lägga till, ändra och ta bort andra administratörer.</p>
      )}
      {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

      {accounts === null ? (
        <div className="py-20 flex justify-center"><div className="w-6 h-6 border-2 border-white/50 border-t-transparent rounded-full animate-spin" /></div>
      ) : list.length === 0 ? (
        <div className="rounded-3xl bg-[#1c1c1f] p-10 text-center text-white/50">Inga konton här än.</div>
      ) : (
        <div className="space-y-2">
          {list.map(a => (
            <div key={a.id} className={clsx('rounded-2xl bg-[#1c1c1f] px-4 sm:px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3', a.disabled && 'opacity-60')}>
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <span className="w-10 h-10 rounded-full bg-white/10 text-sm font-bold flex items-center justify-center shrink-0">
                  {a.name.split(/\s+/).filter(w => w[0] && w[0].toLowerCase() !== w[0].toUpperCase()).slice(0, 2).map(w => w[0].toUpperCase()).join('')}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {a.role === 'school'
                      ? <Link href={`/${locale}/admin/trafikskolor/${a.id}`} className="font-bold hover:underline">{a.name}</Link>
                      : <span className="font-bold">{a.name}</span>}
                    {a.superUser && <Badge tone="blue">Superanvändare</Badge>}
                    {a.isMe && <Badge>Du</Badge>}
                    {a.disabled && <Badge tone="red">Inaktiverad</Badge>}
                  </div>
                  <p className="text-sm text-white/50 truncate">{[a.email, a.phone].filter(Boolean).join(' · ')}</p>
                  <p className="text-xs text-white/35 mt-0.5">
                    Skapad {formatDate(a.createdAt)}
                    {a.upcomingCourses !== undefined && ` · ${a.upcomingCourses} kommande kurs${a.upcomingCourses === 1 ? '' : 'er'}`}
                  </p>
                </div>
              </div>
              {a.canManage && (
                <div className="flex flex-wrap gap-1.5 sm:justify-end -ml-1 sm:ml-0">
                  <IconButton label="Redigera" onClick={() => setEditing(a)}><Pencil className="w-4 h-4" /></IconButton>
                  <IconButton label="Nytt lösenord" onClick={() => resetPassword(a)}><KeyRound className="w-4 h-4" /></IconButton>
                  {!a.superUser && !a.isMe && (a.role === 'school' && a.hasHistory ? (
                    <IconButton label={a.disabled ? 'Aktivera' : 'Inaktivera'} onClick={() => toggleDisabled(a)} tone={a.disabled ? 'green' : 'amber'}><Power className="w-4 h-4" /></IconButton>
                  ) : a.disabled ? (
                    <IconButton label="Aktivera" onClick={() => toggleDisabled(a)} tone="green"><Power className="w-4 h-4" /></IconButton>
                  ) : (
                    <IconButton label="Ta bort" onClick={() => remove(a)} tone="red"><Trash2 className="w-4 h-4" /></IconButton>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {creating && (
        <AccountSheet
          title="Nytt konto"
          initial={{ role: tab === 'admin' && !owner ? 'instructor' : tab, name: '', email: '', phone: '' }}
          roles={owner ? ['admin', 'instructor', 'school'] : ['instructor', 'school']}
          onClose={() => setCreating(false)}
          onSave={async v => {
            const res = await fetch('/api/admin/personal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(v) });
            const data = await res.json();
            if (!res.ok) return data.error ?? 'Något gick fel';
            setCreating(false);
            setTab(v.role);
            setPassword({ name: v.name, email: v.email, password: data.password, fresh: true });
            load();
            return null;
          }}
        />
      )}
      {editing && (
        <AccountSheet
          title={`Redigera ${ROLE_LABEL[editing.role].toLowerCase()}`}
          initial={{ role: editing.role, name: editing.name, email: editing.email, phone: editing.phone ?? '' }}
          lockEmail={editing.superUser}
          onClose={() => setEditing(null)}
          onSave={async v => {
            const res = await fetch(`/api/admin/personal/${editing.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: v.name, email: v.email, phone: v.phone }) });
            if (!res.ok) return (await res.json()).error ?? 'Något gick fel';
            setEditing(null);
            load();
            return null;
          }}
        />
      )}
      {password && <PasswordSheet {...password} onClose={() => setPassword(null)} />}
    </AdminShell>
  );
}

function IconButton({ label, onClick, tone, children }: { label: string; onClick: () => void; tone?: 'red' | 'amber' | 'green'; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'inline-flex items-center gap-1.5 h-10 px-3 rounded-full text-sm font-semibold border border-white/10 transition',
        tone === 'red' ? 'text-red-300 hover:bg-red-500/10' : tone === 'amber' ? 'text-amber-300 hover:bg-amber-500/10' : tone === 'green' ? 'text-emerald-300 hover:bg-emerald-500/10' : 'text-white/80 hover:bg-white/10',
      )}
    >
      {children}{label}
    </button>
  );
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={e => e.stopPropagation()}
        className="sheet bg-[#1c1c1f] text-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md max-h-[92dvh] overflow-y-auto p-5 sm:p-6 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-6"
      >
        <div className="flex items-start justify-between gap-3 mb-5 pt-2 sm:pt-0">
          <h3 className="font-headline text-xl font-extrabold">{title}</h3>
          <button onClick={onClose} aria-label="Stäng" className="w-10 h-10 -mr-2 rounded-full hover:bg-white/10 flex items-center justify-center shrink-0"><X className="w-5 h-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

interface FormValues { role: Role; name: string; email: string; phone: string }

function AccountSheet({ title, initial, roles, lockEmail, onClose, onSave }: {
  title: string; initial: FormValues; roles?: Role[]; lockEmail?: boolean;
  onClose: () => void; onSave: (v: FormValues) => Promise<string | null>;
}) {
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k: keyof FormValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV({ ...v, [k]: e.target.value });

  const save = async () => {
    setBusy(true);
    setError('');
    const err = await onSave(v);
    setBusy(false);
    if (err) setError(err);
  };

  return (
    <Sheet title={title} onClose={onClose}>
      <div className="space-y-4">
        {roles && (
          <Field label="Typ av konto">
            <Select value={v.role} onChange={set('role')}>
              {roles.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
            </Select>
          </Field>
        )}
        <Field label={v.role === 'school' ? 'Trafikskolans namn' : 'Namn'} required><Input value={v.name} onChange={set('name')} autoComplete="off" /></Field>
        <Field label="E-post (inloggning)" required><Input type="email" value={v.email} onChange={set('email')} disabled={lockEmail} autoComplete="off" /></Field>
        <Field label="Telefon"><Input type="tel" value={v.phone} onChange={set('phone')} /></Field>
        {roles && <p className="text-xs text-white/45">Ett lösenord skapas automatiskt och mejlas till {v.email || 'personen'}. Du ser det också en gång här.</p>}
        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="flex gap-3">
          <Button onClick={onClose}>Avbryt</Button>
          <Button variant="primary" className="flex-1" disabled={busy || !v.name.trim() || !v.email.trim()} onClick={save}>{busy ? 'Sparar…' : roles ? 'Skapa konto' : 'Spara'}</Button>
        </div>
      </div>
    </Sheet>
  );
}

function PasswordSheet({ name, email, password, fresh, onClose }: { name: string; email: string; password: string; fresh: boolean; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <Sheet title={fresh ? 'Kontot är skapat' : 'Nytt lösenord'} onClose={onClose}>
      <p className="text-sm text-white/70">Inloggningen har mejlats till <strong className="text-white">{email}</strong>. Lösenordet för {name} visas bara nu:</p>
      <div className="flex items-center gap-2 mt-4 rounded-2xl bg-white/5 border border-white/10 px-4 py-3">
        <code className="flex-1 font-mono text-lg tracking-wide break-all">{password}</code>
        <button
          onClick={() => navigator.clipboard?.writeText(password).then(() => setCopied(true))}
          aria-label="Kopiera lösenordet"
          className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center shrink-0"
        >
          <Copy className="w-4 h-4" />
        </button>
      </div>
      {copied && <p className="text-sm text-emerald-300 mt-2">Kopierat</p>}
      <Button variant="primary" className="w-full mt-5" onClick={onClose}>Klar</Button>
    </Sheet>
  );
}
