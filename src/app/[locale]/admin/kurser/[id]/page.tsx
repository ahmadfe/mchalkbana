'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import clsx from 'clsx';
import AdminShell from '@/components/admin/AdminShell';
import KindBadge from '@/components/admin/KindBadge';
import CheckInModal from '@/components/CheckInModal';
import { Badge, Button, Card, Checkbox, Select, formatDate } from '@/components/admin/ui';

interface Kurs {
  id: number;
  title: string;
  courseType: string;
  behorighet: string;
  coursePrice: number;
  discountPrice: number | null;
  location: string;
  filial: { id: number; name: string };
  startTime: string;
  endTime: string;
  seatLimit: number;
  status: 'planned' | 'completed' | 'canceled';
  selfBooking: boolean;
  reportToTS: boolean;
  reportedAt: string | null;
  internalNotes: string;
  instructors: { id: number; name: string }[];
  schoolAllocations: { name: string; seats: number }[];
}

interface Participant {
  bookingId: number;
  studentId: number | null;
  name: string;
  phone: string;
  email: string;
  personnummer: string;
  status: string;
  bookedBy: string;
  schoolName: string | null;
  price: number;
  payment: { amount: number; provider: string; createdAt: string } | null;
  paid: boolean;
  attendance: string;
  result: string | null;
  checkedInAt: string | null;
  checkedInBy: string | null;
  idType: string | null;
}

const tz = { timeZone: 'Europe/Stockholm' } as const;
const hm = (iso: string) => new Date(iso).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', ...tz });
const kr = (n: number) => `${n.toLocaleString('sv-SE')} kr`;
const STATUS_LABEL = { planned: 'Planerad', completed: 'Genomförd', canceled: 'Inställd' } as const;
const PROVIDER_LABEL: Record<string, string> = { cash: 'Kontant', card: 'Kort', swish: 'Swish', invoice: 'Faktura', manual: 'Manuell' };
const ID_LABEL: Record<string, string> = { korkort: 'körkort', pass: 'pass', nationellt_id: 'nationellt id-kort', id_kort: 'id-kort' };

function download(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function KursPage({ params }: { params: { id: string } }) {
  const locale = useLocale();
  const [kurs, setKurs] = useState<Kurs | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unpaid'>('all');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/kurser/${params.id}`);
    if (!res.ok) { setNotFound(true); return; }
    const data = await res.json();
    setKurs(data.kurs);
    setParticipants(data.participants);
  }, [params.id]);
  useEffect(() => { load(); }, [load]);

  const patchKurs = async (body: Record<string, unknown>) => {
    setBusy(true);
    const res = await fetch(`/api/admin/kurser/${params.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    setBusy(false);
    if (!res.ok) alert((await res.json()).error ?? 'Något gick fel');
    await load();
  };

  if (notFound) {
    return (
      <AdminShell title="Kursen hittades inte" back={{ href: '/admin/kurser', label: 'Kurser' }}>
        <p className="text-white/50">Kursen finns inte eller har tagits bort.</p>
      </AdminShell>
    );
  }
  if (!kurs) {
    return (
      <AdminShell title="Kurs" back={{ href: '/admin/kurser', label: 'Kurser' }}>
        <div className="py-20 flex justify-center"><div className="w-6 h-6 border-2 border-white/50 border-t-transparent rounded-full animate-spin" /></div>
      </AdminShell>
    );
  }

  const active = participants.filter(p => p.status !== 'Canceled');
  const canceled = participants.filter(p => p.status === 'Canceled');
  const selfPaying = active.filter(p => !p.schoolName);
  const unpaid = selfPaying.filter(p => !p.paid);
  const paidCount = selfPaying.length - unpaid.length;
  const outstanding = unpaid.reduce((sum, p) => sum + p.price, 0);
  const value = active.reduce((sum, p) => sum + p.price, 0);
  const shown = filter === 'unpaid' ? unpaid : active;
  const price = kurs.discountPrice ?? kurs.coursePrice;
  const isPast = new Date(kurs.endTime) < new Date();

  const dateLine = (() => {
    const d = new Date(kurs.startTime).toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', ...tz });
    return `${d.charAt(0).toUpperCase()}${d.slice(1)} · ${hm(kurs.startTime)}–${hm(kurs.endTime)} · ${kurs.location} · ${kr(price)}`;
  })();

  const reportLabel = !kurs.reportToTS ? 'Rapporteras ej'
    : kurs.reportedAt ? `Rapporterad ${formatDate(kurs.reportedAt, { day: 'numeric', month: 'short' })}`
    : 'Inte rapporterad';

  const exportCsv = () => {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const rows = [
      ['Namn', 'Personnummer', 'Telefon', 'E-post', 'Bokad av', 'Pris', 'Betalning', 'Närvaro', 'Incheckad'],
      ...active.map(p => [
        p.name, p.personnummer, p.phone, p.email, p.schoolName ?? 'Elev', String(p.price),
        p.schoolName ? 'Faktureras skolan' : p.paid ? `Betald${p.payment ? ` (${PROVIDER_LABEL[p.payment.provider] ?? p.payment.provider})` : ''}` : 'Inte betald',
        ATTENDANCE_OPTIONS.find(a => a.value === p.attendance)?.label ?? p.attendance,
        p.checkedInAt ? `${formatDate(p.checkedInAt)} ${hm(p.checkedInAt)}` : '',
      ]),
    ];
    const date = new Date(kurs.startTime).toLocaleDateString('sv-SE', tz);
    download(`deltagare-${date}.csv`, '﻿' + rows.map(r => r.map(esc).join(';')).join('\n'), 'text/csv;charset=utf-8');
  };

  const exportXml = () => {
    const date = new Date(kurs.startTime).toLocaleDateString('sv-SE', tz);
    const elever = active
      .filter(p => p.personnummer && p.attendance !== 'no_show' && p.attendance !== 'late_cancel')
      .map(p => `    <Elev>\n        <PersonNr>${p.personnummer}</PersonNr>\n        <UtbDatum>${date}</UtbDatum>\n    </Elev>`)
      .join('\n');
    const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>\n<Rapport>\n    <Behorighet>${kurs.behorighet || 'B'}</Behorighet>\n${elever}\n</Rapport>`;
    download(`rapport-${date}-kurs${kurs.id}.xml`, xml, 'application/xml;charset=utf-8');
  };

  return (
    <AdminShell
      title={kurs.title}
      back={{ href: '/admin/kurser', label: 'Kurser' }}
      actions={<Link href={`/${locale}/admin/kurser/${kurs.id}/redigera`} className="inline-flex items-center h-11 px-5 rounded-full bg-white/10 border border-white/10 text-sm font-semibold hover:bg-white/15">Redigera</Link>}
    >
      <div className="-mt-4 mb-8">
        <div className="flex items-center gap-2 mb-1.5">
          <KindBadge type={kurs.courseType} />
          <span className="text-xs font-bold uppercase tracking-[0.12em] text-white/60">
            {kurs.status === 'canceled' ? 'Inställd' : kurs.reportToTS && !kurs.reportedAt ? 'Ska rapporteras' : kurs.filial.name}
          </span>
        </div>
        <p className={clsx('text-white/80', kurs.status === 'canceled' && 'line-through text-white/40')}>{dateLine}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Stat value={`${active.length}/${kurs.seatLimit}`} label="Anmälda av platser" />
        <Stat value={STATUS_LABEL[kurs.status]} label="Status" tone={kurs.status === 'canceled' ? 'red' : kurs.status === 'completed' ? 'green' : undefined} />
        <Stat value={reportLabel} label="Rapportering" tone={kurs.reportedAt ? 'green' : undefined} muted={!kurs.reportToTS} />
        <Stat value={kr(value)} label="Värde" muted={value === 0} />
      </div>

      <div className="grid lg:grid-cols-[1.25fr_1fr] gap-4 items-start">
        <Card
          title="Deltagare"
          aside={
            <div className="flex gap-2">
              <Link href={`/${locale}/admin/kurser/${kurs.id}/lista`} target="_blank" className="h-9 px-3.5 inline-flex items-center rounded-full bg-white/10 text-sm font-semibold hover:bg-white/15">Lista (PDF)</Link>
              <button onClick={exportCsv} className="h-9 px-3.5 rounded-full bg-white/10 text-sm font-semibold hover:bg-white/15">CSV</button>
            </div>
          }
        >
          {active.length === 0 ? (
            <p className="text-sm text-white/60">Inga anmälda än. Anmäl elever nedan{kurs.selfBooking ? ', eller låt dem anmäla sig själva på webbplatsen' : ''}.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 mb-4">
                {([['all', 'Alla', active.length], ['unpaid', 'Inte betalda', unpaid.length]] as const).map(([key, label, n]) => (
                  <button
                    key={key}
                    onClick={() => setFilter(key)}
                    className={clsx('h-9 px-4 rounded-full text-sm font-semibold transition',
                      filter === key ? 'bg-white text-black' : 'bg-transparent border border-white/15 text-white/70 hover:text-white')}
                  >
                    {label} <span className="ml-1 opacity-60">{n}</span>
                  </button>
                ))}
                <span className="text-sm ml-auto">
                  <span className="text-emerald-400 font-semibold">{paidCount} betalda</span>
                  <span className="text-white/40"> · </span>
                  <span className={unpaid.length ? 'text-red-400 font-semibold' : 'text-white/50'}>{unpaid.length} inte betald{unpaid.length === 1 ? '' : 'a'}</span>
                  {outstanding > 0 && <span className="text-white/50"> · {kr(outstanding)} kvar att få in</span>}
                </span>
              </div>
              <div className="divide-y divide-white/5 -mx-5 sm:-mx-6">
                {shown.map(p => <ParticipantRow key={p.bookingId} p={p} locale={locale} onChange={load} behorighet={kurs.behorighet} canCheckIn={kurs.status !== 'canceled'} />)}
                {shown.length === 0 && <p className="px-6 py-4 text-sm text-white/50">Alla har betalat.</p>}
              </div>
            </>
          )}

          {kurs.status !== 'canceled' && <AddStudent kursId={kurs.id} onAdded={load} locale={locale} />}

          {canceled.length > 0 && (
            <details className="mt-5 text-sm">
              <summary className="cursor-pointer text-white/50 hover:text-white">{canceled.length} avbokade</summary>
              <ul className="mt-2 space-y-1 text-white/50">
                {canceled.map(p => <li key={p.bookingId}>{p.name} · {p.personnummer}</li>)}
              </ul>
            </details>
          )}
        </Card>

        <div className="space-y-4">
          <Card title="Åtgärder">
            <div className="flex flex-wrap gap-2">
              {kurs.status === 'canceled' ? (
                <Button onClick={() => patchKurs({ status: 'planned' })} disabled={busy}>Återställ kursen</Button>
              ) : (
                <Button
                  variant="danger"
                  disabled={busy}
                  onClick={() => {
                    const msg = active.length
                      ? `Ställ in kursen?\n\n${active.length} anmälda får INTE automatiskt besked. Flytta eller avboka dem och återbetala eventuella betalningar.`
                      : 'Ställ in kursen? Den försvinner från webbplatsen.';
                    if (confirm(msg)) patchKurs({ status: 'canceled' });
                  }}
                >
                  Ställ in kursen
                </Button>
              )}
              {kurs.status === 'planned' && isPast && <Button onClick={() => patchKurs({ status: 'completed' })} disabled={busy}>Markera som genomförd</Button>}
              {kurs.status === 'completed' && <Button onClick={() => patchKurs({ status: 'planned' })} disabled={busy}>Ångra genomförd</Button>}
            </div>

            {kurs.reportToTS && kurs.status !== 'canceled' && (
              <div className="mt-5 pt-5 border-t border-white/5">
                <p className="text-sm font-semibold mb-1">Rapportering till Transportstyrelsen</p>
                <p className="text-sm text-white/50 mb-3">
                  Ladda ner XML-filen med deltagarnas personnummer och skicka in den. Markera sedan kursen som rapporterad.
                  Elever som uteblev eller avanmälde sig sent tas inte med.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={exportXml} disabled={active.length === 0}>Ladda ner XML</Button>
                  {kurs.reportedAt
                    ? <Button onClick={() => patchKurs({ reported: false })} disabled={busy}>Ångra rapporterad</Button>
                    : <Button variant="primary" onClick={() => patchKurs({ reported: true })} disabled={busy || active.length === 0}>Markera som rapporterad</Button>}
                </div>
              </div>
            )}
          </Card>

          <Card title="Detaljer">
            <dl className="space-y-3 text-sm">
              <Detail label="Filial">{kurs.filial.name}</Detail>
              <Detail label="Lärare">{kurs.instructors.length ? kurs.instructors.map(i => i.name).join(', ') : 'Ingen tilldelad'}</Detail>
              <Detail label="Bokning">{kurs.selfBooking ? 'Syns på webbplatsen' : 'Bara admin och trafikskolor'}</Detail>
              {kurs.schoolAllocations.length > 0 && (
                <Detail label="Skolkvoter">{kurs.schoolAllocations.map(a => `${a.name} (${a.seats})`).join(', ')}</Detail>
              )}
              {kurs.internalNotes && <Detail label="Anteckningar"><span className="whitespace-pre-wrap">{kurs.internalNotes}</span></Detail>}
            </dl>
          </Card>
        </div>
      </div>
    </AdminShell>
  );
}

function Stat({ value, label, tone, muted }: { value: string; label: string; tone?: 'green' | 'red'; muted?: boolean }) {
  return (
    <div className="rounded-3xl bg-[#1c1c1f] p-5">
      <p className={clsx('font-headline text-lg sm:text-xl xl:text-2xl font-extrabold leading-tight break-words',
        tone === 'green' && 'text-emerald-300', tone === 'red' && 'text-red-400', muted && 'text-white/40')}>
        {value}
      </p>
      <p className="text-sm text-white/50 mt-1">{label}</p>
    </div>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <dt className="w-28 shrink-0 text-white/50">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

const ATTENDANCE_OPTIONS = [
  { value: 'registered', label: 'Anmäld' },
  { value: 'attended', label: 'Deltog' },
  { value: 'no_show', label: 'Uteblev' },
  { value: 'late_cancel', label: 'Sen avanmälan' },
];

function ParticipantRow({ p, locale, onChange, behorighet, canCheckIn }: {
  p: Participant;
  locale: string;
  onChange: () => Promise<void>;
  behorighet: string;
  canCheckIn: boolean;
}) {
  const [checkingIn, setCheckingIn] = useState(false);
  const [paying, setPaying] = useState(false);
  const [amount, setAmount] = useState(String(p.price));
  const [provider, setProvider] = useState('cash');
  const [busy, setBusy] = useState(false);

  const call = async (url: string, method: string, body: unknown) => {
    setBusy(true);
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) alert((await res.json()).error ?? 'Något gick fel');
    await onChange();
    setBusy(false);
  };

  const pay = async () => {
    await call(`/api/admin/bookings/${p.bookingId}/payment`, 'POST', { amount: Number(amount), provider });
    setPaying(false);
  };

  const cancel = () => {
    if (!confirm(`Avboka ${p.name}?${p.payment ? '\n\nBetalningen återbetalas inte automatiskt.' : ''}`)) return;
    const notify = !!p.email && confirm('Skicka avbokningsbekräftelse via e-post till eleven?');
    call(`/api/admin/deltagare/${p.bookingId}`, 'PATCH', { cancel: true, notify });
  };

  return (
    <div className="px-5 sm:px-6 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {p.studentId
            ? <Link href={`/${locale}/admin/elever/${p.studentId}`} className="font-bold hover:underline">{p.name}</Link>
            : <span className="font-bold">{p.name}</span>}
          <p className="text-sm text-white/50 truncate">{[p.phone, p.email].filter(Boolean).join(' · ') || 'Inga kontaktuppgifter'}</p>
        </div>
        <button onClick={cancel} disabled={busy} className="text-sm text-white/40 hover:text-red-400 shrink-0">Avboka</button>
      </div>

      <div className="flex flex-wrap items-center gap-2 mt-2 text-sm">
        {p.schoolName ? (
          <><Badge tone="blue">Skola</Badge><span className="text-white/60">{kr(p.price)} – faktureras {p.schoolName}</span></>
        ) : p.paid ? (
          <><Badge tone="green">Betald</Badge><span className="text-white/60">
            {kr(p.price)}{p.payment ? ` · ${PROVIDER_LABEL[p.payment.provider] ?? p.payment.provider} ${formatDate(p.payment.createdAt, { day: 'numeric', month: 'short' })}` : ''}
          </span></>
        ) : (
          <><Badge tone="amber">Inte betald</Badge><span className="text-white/60">{kr(p.price)} – eleven har inte betalat än.</span></>
        )}
      </div>

      {!p.paid && !p.schoolName && (
        paying ? (
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="w-28 h-10 px-3 rounded-xl bg-[#26262a] border border-white/10 text-white focus:outline-none focus:border-white/40"
            />
            <Select value={provider} onChange={e => setProvider(e.target.value)} className="!w-32 !h-10">
              <option value="cash">Kontant</option>
              <option value="card">Kort</option>
              <option value="swish">Swish</option>
            </Select>
            <Button variant="primary" className="!h-10" onClick={pay} disabled={busy || !Number(amount)}>Bekräfta</Button>
            <Button className="!h-10" onClick={() => setPaying(false)}>Avbryt</Button>
          </div>
        ) : (
          <Button className="!h-10 mt-3" onClick={() => setPaying(true)}>Ta betalt i kassan</Button>
        )
      )}

      <p className={clsx('text-sm mt-3', p.checkedInAt ? 'text-emerald-300/90' : 'text-amber-300/90')}>
        {p.checkedInAt
          ? `Incheckad ${hm(p.checkedInAt)}${p.idType ? ` med ${ID_LABEL[p.idType] ?? p.idType}` : ''}${p.checkedInBy ? ` av ${p.checkedInBy}` : ''}`
          : 'Inte incheckad – legitimation och personnummer ska kontrolleras'}
      </p>

      <div className="flex flex-wrap items-center gap-2 mt-3">
        {canCheckIn && !p.checkedInAt && (
          <Button className="!h-10" onClick={() => setCheckingIn(true)} disabled={busy}>Checka in</Button>
        )}
        {p.checkedInAt && (
          <Button
            className="!h-10"
            disabled={busy}
            onClick={() => confirm(`Ångra incheckningen av ${p.name}? Raden i riskregistret tas bort.`) && call(`/api/checkin/${p.bookingId}`, 'DELETE', {})}
          >
            Ångra incheckning
          </Button>
        )}
        <Select
          value={p.attendance}
          disabled={busy}
          onChange={e => call(`/api/admin/deltagare/${p.bookingId}`, 'PATCH', { attendance: e.target.value })}
          className="!w-44 !h-10"
        >
          {ATTENDANCE_OPTIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
        </Select>
        {p.result === 'passed' && <Badge tone="green">Godkänd av lärare</Badge>}
      </div>

      {checkingIn && (
        <CheckInModal
          person={{ bookingId: p.bookingId, name: p.name, email: p.email, phone: p.phone, personnummer: p.personnummer, behorighet }}
          onClose={() => setCheckingIn(false)}
          onDone={async () => { setCheckingIn(false); await onChange(); }}
        />
      )}
    </div>
  );
}

interface StudentHit { id: number; name: string; personnummer: string; phone: string; email: string }

function AddStudent({ kursId, onAdded, locale }: { kursId: number; onAdded: () => Promise<void>; locale: string }) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<StudentHit[]>([]);
  const [picked, setPicked] = useState<StudentHit | null>(null);
  const [sendConfirmation, setSendConfirmation] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const ctrl = useRef<AbortController | null>(null);

  useEffect(() => {
    if (picked || q.trim().length < 2) { setHits([]); return; }
    const t = setTimeout(() => {
      ctrl.current?.abort();
      ctrl.current = new AbortController();
      fetch(`/api/admin/students?q=${encodeURIComponent(q)}`, { signal: ctrl.current.signal })
        .then(r => r.json()).then(d => setHits((d.students ?? []).slice(0, 8))).catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [q, picked]);

  const add = async () => {
    if (!picked) return;
    setBusy(true);
    setError('');
    const res = await fetch(`/api/admin/kurser/${kursId}/deltagare`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId: picked.id, sendConfirmation }),
    });
    setBusy(false);
    if (!res.ok) { setError((await res.json()).error ?? 'Något gick fel'); return; }
    setPicked(null);
    setQ('');
    await onAdded();
  };

  return (
    <div className="mt-5 -mx-5 sm:-mx-6 -mb-5 sm:-mb-6 px-5 sm:px-6 py-5 border-t border-white/5">
      <p className="font-bold mb-3">Anmäl elev</p>
      {picked ? (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-[#26262a] border border-white/10 px-4 py-3">
          <div className="min-w-0">
            <p className="font-semibold truncate">{picked.name}</p>
            <p className="text-sm text-white/50 truncate">{[picked.personnummer, picked.phone].filter(Boolean).join(' · ')}</p>
          </div>
          <button onClick={() => setPicked(null)} className="text-sm text-white/50 hover:text-white shrink-0">Byt</button>
        </div>
      ) : (
        <div className="relative">
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Sök elev – namn, personnummer, telefon eller e-post"
            className="w-full h-12 px-4 rounded-xl bg-[#26262a] border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-white/40"
          />
          {hits.length > 0 && (
            <div className="absolute z-10 left-0 right-0 mt-1 rounded-xl bg-[#2a2a2f] border border-white/10 shadow-2xl overflow-hidden">
              {hits.map(h => (
                <button key={h.id} onClick={() => { setPicked(h); setHits([]); }} className="w-full text-left px-4 py-2.5 hover:bg-white/5">
                  <p className="font-semibold text-sm">{h.name}</p>
                  <p className="text-xs text-white/50">{[h.personnummer, h.phone].filter(Boolean).join(' · ')}</p>
                </button>
              ))}
            </div>
          )}
          {q.trim().length >= 2 && hits.length === 0 && (
            <p className="text-sm text-white/50 mt-2">
              Hittar du inte eleven? <Link href={`/${locale}/admin/elever/ny`} className="underline">Lägg till en ny elev</Link> först.
            </p>
          )}
        </div>
      )}
      {picked && (
        <div className="mt-3">
          <Checkbox checked={sendConfirmation} onChange={setSendConfirmation}>Skicka bokningsbekräftelse via e-post</Checkbox>
        </div>
      )}
      {error && <p className="text-sm text-red-400 mt-3">{error}</p>}
      <Button variant="primary" className="mt-4" onClick={add} disabled={!picked || busy}>{busy ? 'Anmäler…' : 'Anmäl elev'}</Button>
    </div>
  );
}
