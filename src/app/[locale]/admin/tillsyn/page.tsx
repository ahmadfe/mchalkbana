'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { AlertTriangle, CheckCircle2, X } from 'lucide-react';
import clsx from 'clsx';
import AdminShell from '@/components/admin/AdminShell';
import { Button, Card, formatDate } from '@/components/admin/ui';

interface Overview {
  period: string;
  students: number;
  completedCourses: number;
  plannedCourses: number;
  riskEntries: number;
  issues: { kind: string; sessionId: number; text: string; date: string }[];
  legacyUnreported: number;
  downloads: { id: number; userName: string; kind: string; period: string; createdAt: string }[];
}
interface Table { title: string; columns: string[]; rows: string[][] }
type Kind = 'elevregister' | 'kursregister' | 'riskregister';
type Action = { kind: Kind; format: 'csv' | 'pdf' };

const KIND_LABEL: Record<string, string> = {
  'elevregister.csv': 'Elevregister (CSV)', 'elevregister.json': 'Elevregister (PDF)',
  'kursregister.csv': 'Kursregister (CSV)', 'kursregister.json': 'Kursregister (PDF)',
  'riskregister.csv': 'Riskregister (CSV)', 'riskregister.json': 'Riskregister (PDF)',
};

const thisYear = new Date().getFullYear();
const PERIODS = [`${thisYear - 1}-${thisYear}`, String(thisYear), String(thisYear - 1), String(thisYear - 2)];

function escapeHtml(s: string) {
  return s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
}

/** Skriver ut en tabell via en dold iframe – webbläsarens "Spara som PDF" ger filen. */
function printTable(t: Table) {
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(frame);
  const doc = frame.contentDocument!;
  doc.open();
  doc.write(`<!doctype html><html lang="sv"><head><meta charset="utf-8"><title>${escapeHtml(t.title)}</title><style>
    @page { size: A4 landscape; margin: 12mm; }
    body { font: 10px/1.35 Arial, sans-serif; color: #000; }
    h1 { font-size: 16px; margin: 0 0 2px; } p { margin: 0 0 10px; color: #555; }
    table { width: 100%; border-collapse: collapse; } th, td { text-align: left; padding: 4px 6px; border-bottom: 1px solid #ccc; vertical-align: top; }
    th { border-bottom: 2px solid #000; } tr { page-break-inside: avoid; }
  </style></head><body>
    <h1>${escapeHtml(t.title)}</h1>
    <p>Uppsala Halkbana · utskriven ${new Date().toLocaleString('sv-SE')} · ${t.rows.length} rader · innehåller personnummer</p>
    <table><thead><tr>${t.columns.map(c => `<th>${escapeHtml(c)}</th>`).join('')}</tr></thead>
    <tbody>${t.rows.map(r => `<tr>${r.map(c => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>
  </body></html>`);
  doc.close();
  frame.contentWindow!.focus();
  frame.contentWindow!.print();
  setTimeout(() => frame.remove(), 60_000);
}

export default function TillsynPage() {
  const locale = useLocale();
  const [period, setPeriod] = useState(String(thisYear));
  const [data, setData] = useState<Overview | null>(null);
  const [token, setToken] = useState<{ value: string; expires: number } | null>(null);
  const [pending, setPending] = useState<Action | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setData(null);
    fetch(`/api/admin/tillsyn?period=${period}`).then(r => r.json()).then(setData);
  }, [period]);
  useEffect(load, [load]);

  const run = async (action: Action, tok: string) => {
    const id = `${action.kind}.${action.format}`;
    setBusy(id);
    setError('');
    const params = new URLSearchParams({ kind: action.kind, format: action.format === 'pdf' ? 'json' : 'csv', period });
    const res = await fetch(`/api/admin/tillsyn/export?${params}`, { headers: { 'x-export-token': tok } });
    setBusy(null);
    if (res.status === 401) { setToken(null); setPending(action); return; }
    if (!res.ok) { setError((await res.json()).error ?? 'Nedladdningen misslyckades'); return; }
    if (action.format === 'pdf') {
      printTable(await res.json());
    } else {
      const name = res.headers.get('content-disposition')?.match(/filename="(.+)"/)?.[1] ?? `${action.kind}.csv`;
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    }
    load();
  };

  const download = (action: Action) => {
    if (token && token.expires > Date.now()) run(action, token.value);
    else setPending(action);
  };

  const issues = data?.issues ?? [];

  return (
    <AdminShell title="Tillsyn">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-white/60 mb-1">Transportstyrelsens tillsyn</p>
      <p className="text-lg text-white/80 mb-4">Elevregistret, kurserna och riskregistret – och det som behöver rättas först.</p>

      <div className="flex flex-wrap gap-2 mb-6">
        {PERIODS.map(p => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={clsx('h-9 px-4 rounded-full text-sm font-semibold transition',
              period === p ? 'bg-white text-black' : 'bg-white/10 text-white/70 hover:text-white')}
          >
            {p.replace('-', '–')}
          </button>
        ))}
      </div>

      {!data ? (
        <div className="py-20 flex justify-center"><div className="w-6 h-6 border-2 border-white/50 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <Stat value={String(data.students)} label="elever" />
            <Stat value={String(data.completedCourses)} label={`genomförda kurser${data.plannedCourses ? ` · ${data.plannedCourses} planerade` : ''}`} />
            {issues.length === 0
              ? <Stat value="✓" label="inga brister" tone="green" />
              : <Stat value={String(issues.length)} label={issues.length === 1 ? 'brist att rätta' : 'brister att rätta'} tone="amber" />}
          </div>

          <div className="grid md:grid-cols-3 gap-3">
            <RegisterCard
              title="Elevregister"
              text="Namn, personnummer, behörighet, registreringsdatum, datum för Risk 1 och Risk 2 samt kurserna under perioden med närvaro och legitimation."
            >
              <Button variant="primary" onClick={() => download({ kind: 'elevregister', format: 'pdf' })} disabled={!!busy}>Elevregister (PDF)</Button>
              <Button onClick={() => download({ kind: 'elevregister', format: 'csv' })} disabled={!!busy}>Excel (CSV)</Button>
            </RegisterCard>
            <RegisterCard
              title="Kursregister"
              text="Varje kurstillfälle under perioden: datum, tid, kurs, filial, lärare, antal anmälda, deltagande och incheckade, status och när kursen rapporterades."
            >
              <Button variant="primary" onClick={() => download({ kind: 'kursregister', format: 'pdf' })} disabled={!!busy}>Kursregister (PDF)</Button>
              <Button onClick={() => download({ kind: 'kursregister', format: 'csv' })} disabled={!!busy}>CSV</Button>
            </RegisterCard>
            <RegisterCard
              title="Riskutbildning"
              text="Registret över deltagare de senaste fem åren: namn, personnummer, vilken legitimation som kontrollerades, när och av vem. Finns kvar även om eleven har raderats."
            >
              <Button onClick={() => download({ kind: 'riskregister', format: 'csv' })} disabled={!!busy}>Riskregister (CSV)</Button>
              <Button onClick={() => download({ kind: 'riskregister', format: 'pdf' })} disabled={!!busy}>PDF</Button>
            </RegisterCard>
          </div>

          <p className="text-sm text-white/50 mt-3 mb-6 max-w-3xl">
            Filerna innehåller personnummer. Nedladdningen loggas och kräver att du bekräftar med en kod som skickas till din e-post.
            Spara dem säkert och radera dem när tillsynen är klar.
            {busy && <span className="text-white/80"> Hämtar…</span>}
          </p>
          {error && <p className="text-sm text-red-400 -mt-4 mb-6">{error}</p>}

          <Card
            title="Att rätta före tillsyn"
            aside={<span className={clsx('h-8 px-3 inline-flex items-center rounded-full text-xs font-semibold', issues.length ? 'bg-amber-500/15 text-amber-300' : 'bg-white/10 text-white/70')}>
              {issues.length ? `${issues.length} att rätta` : 'Allt ser bra ut'}
            </span>}
            className="mb-4"
          >
            {issues.length === 0 ? (
              <div className="flex items-center gap-4">
                <span className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center shrink-0"><CheckCircle2 className="w-5 h-5 text-white/70" /></span>
                <p className="text-sm text-white/70 max-w-xl">
                  Alla genomförda kurser under perioden är rapporterade, alla deltagare har personnummer och – från och med digital incheckning – närvaro och kontrollerad legitimation.
                </p>
              </div>
            ) : (
              <>
              {data.legacyUnreported > 0 && (
                <div className="rounded-2xl bg-white/5 p-4 mb-4">
                  <p className="text-sm text-white/80">
                    {data.legacyUnreported} kurser före 25 oktober 2026 saknar datum för rapportering eftersom det inte registrerades i systemet då.
                    Har ni redan rapporterat dem kan du markera alla på en gång – rapporteringsdatumet blir kursens slutdatum.
                  </p>
                  <Button
                    className="mt-3"
                    disabled={!!busy}
                    onClick={async () => {
                      if (!confirm(`Markera ${data.legacyUnreported} kurser före 25 oktober 2026 som rapporterade till Transportstyrelsen?\n\nGör bara detta om de faktiskt är rapporterade.`)) return;
                      setBusy('legacy');
                      await fetch('/api/admin/tillsyn/tidigare-rapporterade', { method: 'POST' });
                      setBusy(null);
                      load();
                    }}
                  >
                    Markera tidigare kurser som rapporterade
                  </Button>
                </div>
              )}
              <ul className="divide-y divide-white/5 -my-2">
                {issues.map((i, n) => (
                  <li key={n}>
                    <Link href={`/${locale}/admin/kurser/${i.sessionId}`} className="flex items-start gap-3 py-3 group">
                      <AlertTriangle className="w-4 h-4 text-amber-300 mt-0.5 shrink-0" />
                      <span className="text-sm text-white/80 group-hover:text-white group-hover:underline">{i.text}</span>
                    </Link>
                  </li>
                ))}
              </ul>
              </>
            )}
          </Card>

          <Card title="Senaste nedladdningar">
            {data.downloads.length === 0 ? (
              <p className="text-sm text-white/50">Inga register har laddats ner än.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {data.downloads.map(d => (
                  <li key={d.id} className="flex flex-wrap gap-x-3 text-white/70">
                    <span className="text-white/50 w-36">{formatDate(d.createdAt, { day: 'numeric', month: 'short', year: 'numeric' })} {new Date(d.createdAt).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}</span>
                    <span className="font-semibold text-white">{KIND_LABEL[d.kind] ?? d.kind}</span>
                    <span>{d.period}</span>
                    <span className="text-white/50">av {d.userName}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}

      {pending && (
        <CodeModal
          onClose={() => setPending(null)}
          onVerified={tok => {
            setToken({ value: tok, expires: Date.now() + 14 * 60_000 });
            const action = pending;
            setPending(null);
            run(action, tok);
          }}
        />
      )}
    </AdminShell>
  );
}

function Stat({ value, label, tone }: { value: string; label: string; tone?: 'green' | 'amber' }) {
  return (
    <div className="rounded-3xl bg-[#1c1c1f] p-5">
      <p className={clsx('font-headline text-2xl font-extrabold', tone === 'green' && 'text-emerald-400', tone === 'amber' && 'text-amber-300')}>{value}</p>
      <p className="text-sm text-white/50 mt-1">{label}</p>
    </div>
  );
}

function RegisterCard({ title, text, children }: { title: string; text: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl bg-[#1c1c1f] p-5 sm:p-6 flex flex-col">
      <h2 className="text-xs font-bold uppercase tracking-[0.12em] text-white/60 mb-4">{title}</h2>
      <p className="text-sm text-white/70 leading-relaxed flex-1">{text}</p>
      <div className="flex flex-wrap gap-2 mt-5">{children}</div>
    </div>
  );
}

function CodeModal({ onClose, onVerified }: { onClose: () => void; onVerified: (token: string) => void }) {
  const [sentTo, setSentTo] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const requested = useRef(false);

  const requestCode = useCallback(async () => {
    setBusy(true);
    setError('');
    const res = await fetch('/api/admin/tillsyn/kod', { method: 'POST' });
    const d = await res.json();
    setBusy(false);
    if (!res.ok) setError(d.error ?? 'Kunde inte skicka koden');
    else setSentTo(d.sentTo);
  }, []);

  useEffect(() => {
    if (requested.current) return;
    requested.current = true;
    requestCode();
  }, [requestCode]);

  const verify = async () => {
    setBusy(true);
    setError('');
    const res = await fetch('/api/admin/tillsyn/verifiera', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }),
    });
    const d = await res.json();
    setBusy(false);
    if (!res.ok) { setError(d.error ?? 'Fel kod'); return; }
    onVerified(d.token);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70" onClick={() => !busy && onClose()}>
      <div role="dialog" aria-modal="true" aria-label="Bekräfta med kod" onClick={e => e.stopPropagation()} className="w-full sm:max-w-md bg-[#1c1c1f] rounded-t-3xl sm:rounded-3xl p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-white/60">Bekräfta nedladdning</p>
            <p className="text-sm text-white/70 mt-2">
              {sentTo ? <>Vi har skickat en kod till <strong className="text-white">{sentTo}</strong>. Den gäller i 10 minuter.</> : busy ? 'Skickar kod…' : ''}
            </p>
          </div>
          <button onClick={onClose} aria-label="Stäng" className="w-10 h-10 shrink-0 rounded-full bg-white/10 hover:bg-white/15 flex items-center justify-center"><X className="w-5 h-5" /></button>
        </div>
        <input
          value={code}
          onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          onKeyDown={e => e.key === 'Enter' && code.length === 6 && verify()}
          placeholder="000000"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          className="w-full h-16 rounded-2xl bg-[#26262a] border border-white/15 text-3xl font-mono text-center tracking-[0.5em] focus:outline-none focus:border-white/40"
        />
        {error && <p className="text-sm text-red-400 mt-3">{error}</p>}
        <div className="flex gap-3 mt-5">
          <Button onClick={requestCode} disabled={busy}>Skicka ny kod</Button>
          <Button variant="primary" className="flex-1" onClick={verify} disabled={busy || code.length !== 6}>Bekräfta</Button>
        </div>
      </div>
    </div>
  );
}
