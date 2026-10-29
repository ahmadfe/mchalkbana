'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import clsx from 'clsx';
import AdminShell from '@/components/admin/AdminShell';
import { KurserSideList } from '@/components/admin/SideLists';
import KindBadge from '@/components/admin/KindBadge';
import CheckInModal from '@/components/CheckInModal';
import IdScan from '@/components/admin/IdScan';
import { buildTsReportXml, reportParts } from '@/lib/tsReport';
import { normalizePersonnummer } from '@/lib/pnr';
import { Badge, Button, Card, Checkbox, Select, formatDate } from '@/components/admin/ui';
import { ReservationFields, newReservation, reservationPayload, useReservationData, type ReservationDraft } from '@/components/admin/Reservations';

interface Kurs {
  id: number;
  title: string;
  courseType: string;
  behorighet: string;
  coursePrice: number;
  discountPrice: number | null;
  location: string;
  filial: { id: number; name: string; bana: string };
  startTime: string;
  endTime: string;
  seatLimit: number;
  status: 'planned' | 'completed' | 'canceled';
  selfBooking: boolean;
  reportToTS: boolean;
  reportedAt: string | null;
  internalNotes: string;
  instructors: { id: number; name: string }[];
  schoolAllocations: Reservation[];
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
  schoolUserId: number | null;
  schoolLocked: string | null;
  note: string | null;
  price: number;
  payment: { amount: number; provider: string; createdAt: string } | null;
  paid: boolean;
  attendance: string;
  result: string | null;
  checkedInAt: string | null;
  checkedInBy: string | null;
  checkInInstructor: string | null;
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
  const sideList = <KurserSideList activeId={Number(params.id)} />;
  const locale = useLocale();
  const [kurs, setKurs] = useState<Kurs | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  // Trafikskolor att välja vid incheckningen (skolan faktureras för eleven)
  const [schools, setSchools] = useState<{ id: number; name: string }[]>([]);
  useEffect(() => {
    fetch('/api/admin/school-accounts').then(r => r.json()).then(d => setSchools((d.accounts ?? []).map((a: { id: number; name: string }) => ({ id: a.id, name: a.name })).sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'sv'))));
  }, []);
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
      <AdminShell aside={sideList} title="Kursen hittades inte" back={{ href: '/admin/kurser', label: 'Kurser' }}>
        <p className="text-white/50">Kursen finns inte eller har tagits bort.</p>
      </AdminShell>
    );
  }
  if (!kurs) {
    return (
      <AdminShell aside={sideList} title="Kurs" back={{ href: '/admin/kurser', label: 'Kurser' }}>
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
    if (!kurs.filial.bana) {
      alert(`Banans namn saknas för filialen ${kurs.filial.name}. Fyll i det under Filialer → Redigera först.`);
      return;
    }
    const date = new Date(kurs.startTime).toLocaleDateString('sv-SE', tz);
    const elever = active
      .filter(p => p.attendance !== 'no_show' && p.attendance !== 'late_cancel')
      .map(p => ({ personnummer: p.personnummer, name: p.name }));
    const skipped = elever.filter(e => !normalizePersonnummer(e.personnummer));
    if (skipped.length && !confirm(`${skipped.map(e => e.name).join(', ')} saknar giltigt personnummer och tas inte med i rapporten. Fortsätt?`)) return;
    // Kombo ger två filer: en för teori och en för praktik
    for (const del of reportParts(kurs.courseType)) {
      const xml = buildTsReportXml({ bana: kurs.filial.bana, behorighet: kurs.behorighet, del, utbDatum: date, elever });
      download(`rapport-${date}-${del.toLowerCase()}-kurs${kurs.id}.xml`, xml, 'application/xml;charset=utf-8');
    }
  };

  return (
    <AdminShell aside={sideList}
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

      <div className="grid lg:grid-cols-[1.25fr_1fr] lg:group-[.split]/shell:grid-cols-1 2xl:group-[.split]/shell:grid-cols-[1.25fr_1fr] gap-4 items-start">
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
                {shown.map(p => <ParticipantRow key={p.bookingId} p={p} locale={locale} onChange={load} behorighet={kurs.behorighet} canCheckIn={kurs.status !== 'canceled'} instructors={kurs.instructors} schools={schools} />)}
                {shown.length === 0 && <p className="px-6 py-4 text-sm text-white/50">Alla har betalat.</p>}
              </div>
            </>
          )}

          {kurs.status !== 'canceled' && <AddStudent kursId={kurs.id} onAdded={load} locale={locale} />}
          {kurs.status !== 'canceled' && <IdScan kursId={kurs.id} courseStart={kurs.startTime} instructors={kurs.instructors} onDone={load} />}

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

          <ReservationsCard kurs={kurs} participants={participants} onChange={load} />

          <Card title="Detaljer">
            <dl className="space-y-3 text-sm">
              <Detail label="Filial">{kurs.filial.name}</Detail>
              <Detail label="Lärare">{kurs.instructors.length ? kurs.instructors.map(i => i.name).join(', ') : 'Ingen tilldelad'}</Detail>
              <Detail label="Bokning">{kurs.selfBooking ? 'Syns på webbplatsen' : 'Bara admin och trafikskolor'}</Detail>
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

function ParticipantRow({ p, locale, onChange, behorighet, canCheckIn, instructors, schools }: {
  schools: { id: number; name: string }[];
  p: Participant;
  locale: string;
  onChange: () => Promise<void>;
  behorighet: string;
  canCheckIn: boolean;
  instructors: { id: number; name: string }[];
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
          {p.note && <p className="text-sm text-amber-200/90 bg-amber-500/10 rounded-lg px-2.5 py-1.5 mt-1.5 whitespace-pre-wrap">📝 {p.note}{p.schoolName ? ` – ${p.schoolName}` : ''}</p>}
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
          ? `Incheckad ${hm(p.checkedInAt)}${p.idType ? ` med ${ID_LABEL[p.idType] ?? p.idType}` : ''}${p.checkInInstructor || p.checkedInBy ? ` av ${p.checkInInstructor || p.checkedInBy}` : ''}${p.checkInInstructor && p.checkedInBy && p.checkedInBy !== p.checkInInstructor ? ` · registrerad av ${p.checkedInBy}` : ''}`
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
          instructors={instructors}
          school={{ schools, current: p.schoolUserId, currentName: p.schoolName, locked: p.schoolLocked }}
        />
      )}
    </div>
  );
}

interface StudentHit { id: number; name: string; personnummer: string; phone: string; email: string }

function AddStudent({ kursId, onAdded }: { kursId: number; onAdded: () => Promise<void>; locale: string }) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<StudentHit[]>([]);
  const [searched, setSearched] = useState(false);
  const [picked, setPicked] = useState<StudentHit | null>(null);
  const [creating, setCreating] = useState<NewStudent | null>(null);
  const [sendConfirmation, setSendConfirmation] = useState(true);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const ctrl = useRef<AbortController | null>(null);

  useEffect(() => {
    setSearched(false);
    if (picked || creating || q.trim().length < 2) { setHits([]); return; }
    const t = setTimeout(() => {
      ctrl.current?.abort();
      ctrl.current = new AbortController();
      fetch(`/api/admin/students?status=all&q=${encodeURIComponent(q)}`, { signal: ctrl.current.signal })
        .then(r => r.json()).then(d => { setHits((d.students ?? []).slice(0, 8)); setSearched(true); }).catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [q, picked, creating]);

  const reset = () => { setPicked(null); setCreating(null); setQ(''); setHits([]); };

  const enroll = async (studentId: number) => {
    const res = await fetch(`/api/admin/kurser/${kursId}/deltagare`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId, sendConfirmation }),
    });
    if (!res.ok) { setError((await res.json()).error ?? 'Något gick fel'); return false; }
    return true;
  };

  const add = async () => {
    setBusy(true);
    setError('');
    setInfo('');
    let studentId = picked?.id;
    let existed = false;
    if (creating) {
      // Skapa eleven i elevregistret först. Finns personnumret redan anmäls den befintliga eleven.
      const res = await fetch('/api/admin/students', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(creating),
      });
      const data = await res.json();
      if (res.ok) studentId = data.student.id;
      else if (res.status === 409 && data.existingId) {
        studentId = data.existingId;
        existed = true;
      } else { setError(data.error ?? 'Kunde inte skapa eleven'); setBusy(false); return; }
    }
    if (studentId && (await enroll(studentId))) {
      reset();
      if (existed) setInfo('Personnumret fanns redan i elevregistret – den sparade eleven anmäldes.');
    }
    setBusy(false);
    await onAdded();
  };

  const canSubmit = picked
    ? true
    : !!creating && !!creating.firstName.trim() && !!creating.lastName.trim() && !!creating.personnummer.trim();

  return (
    <div className="mt-5 -mx-5 sm:-mx-6 -mb-5 sm:-mb-6 px-5 sm:px-6 py-5 border-t border-white/5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="font-bold">{creating ? 'Ny elev' : 'Anmäl elev'}</p>
        {!picked && !creating && (
          <button onClick={() => { setError(''); setInfo(''); setCreating(prefillFromQuery(q)); }} className="text-sm font-semibold text-white/60 hover:text-white">
            + Ny elev
          </button>
        )}
      </div>

      {picked ? (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-[#26262a] border border-white/10 px-4 py-3">
          <div className="min-w-0">
            <p className="font-semibold truncate">{picked.name}</p>
            <p className="text-sm text-white/50 truncate">{[picked.personnummer, picked.phone].filter(Boolean).join(' · ')}</p>
          </div>
          <button onClick={() => setPicked(null)} className="text-sm text-white/50 hover:text-white shrink-0">Byt</button>
        </div>
      ) : creating ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <SmallInput placeholder="Förnamn *" value={creating.firstName} onChange={v => setCreating({ ...creating, firstName: v })} autoFocus />
            <SmallInput placeholder="Efternamn *" value={creating.lastName} onChange={v => setCreating({ ...creating, lastName: v })} />
            <SmallInput placeholder="Personnummer * (ÅÅÅÅMMDD-XXXX)" value={creating.personnummer} onChange={v => setCreating({ ...creating, personnummer: v })} className="col-span-2 font-mono" inputMode="numeric" />
            <SmallInput placeholder="Telefon" type="tel" value={creating.phone} onChange={v => setCreating({ ...creating, phone: v })} />
            <SmallInput placeholder="E-post" type="email" value={creating.email} onChange={v => setCreating({ ...creating, email: v })} />
          </div>
          <p className="text-xs text-white/50">Eleven sparas i elevregistret och anmäls till kursen. Fler uppgifter kan fyllas i senare under Elever.</p>
          <button onClick={() => { setCreating(null); setError(''); }} className="text-sm text-white/50 hover:text-white">← Tillbaka till sökning</button>
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
              <button onClick={() => setCreating(prefillFromQuery(q))} className="w-full text-left px-4 py-2.5 text-sm text-white/60 hover:bg-white/5 border-t border-white/5">
                + Skapa ny elev
              </button>
            </div>
          )}
          {searched && hits.length === 0 && (
            <div className="mt-2 flex items-center justify-between gap-3 rounded-xl bg-white/5 px-4 py-3">
              <p className="text-sm text-white/60">Ingen elev hittades för &quot;{q.trim()}&quot;.</p>
              <Button className="!h-9 shrink-0" onClick={() => setCreating(prefillFromQuery(q))}>+ Skapa ny elev</Button>
            </div>
          )}
        </div>
      )}

      {(picked || creating) && (
        <div className="mt-3">
          <Checkbox checked={sendConfirmation} onChange={setSendConfirmation}>Skicka bokningsbekräftelse via e-post</Checkbox>
        </div>
      )}
      {error && <p className="text-sm text-red-400 mt-3">{error}</p>}
      {info && <p className="text-sm text-sky-300 mt-3">{info}</p>}
      <Button variant="primary" className="mt-4" onClick={add} disabled={!canSubmit || busy}>
        {busy ? 'Anmäler…' : creating ? 'Skapa och anmäl' : 'Anmäl elev'}
      </Button>
    </div>
  );
}

interface NewStudent { firstName: string; lastName: string; personnummer: string; phone: string; email: string }

/** Lägger det man sökte på i rätt fält: e-post, personnummer, telefon eller namn. */
function prefillFromQuery(raw: string): NewStudent {
  const q = raw.trim();
  const empty: NewStudent = { firstName: '', lastName: '', personnummer: '', phone: '', email: '' };
  if (!q) return empty;
  if (q.includes('@')) return { ...empty, email: q };
  if (/^[\d\s+-]+$/.test(q)) {
    // ÅÅMMDD-XXXX / ÅÅÅÅMMDD-XXXX är personnummer; annars är 07… och +46… telefonnummer
    const looksLikePnr = /^\d{6}(\d{2})?[-+]\d{4}$/.test(q) || (!!normalizePersonnummer(q) && !q.startsWith('0') && !q.startsWith('+'));
    return looksLikePnr ? { ...empty, personnummer: q } : { ...empty, phone: q };
  }
  const [first, ...rest] = q.split(/\s+/);
  return { ...empty, firstName: first, lastName: rest.join(' ') };
}

function SmallInput({ value, onChange, className, ...props }: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> & { value: string; onChange: (v: string) => void }) {
  return (
    <input
      {...props}
      value={value}
      onChange={e => onChange(e.target.value)}
      className={clsx('w-full h-11 px-3.5 rounded-xl bg-[#26262a] border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-white/40', className)}
    />
  );
}

interface Reservation {
  schoolUserId: number;
  name: string;
  email: string;
  seats: number;
  used: number;
  meetingPlace: string;
  fillBy: string | null;
  message: string;
  notifiedAt: string | null;
  releasedAt: string | null;
}

/** Platser reserverade åt trafikskolor: lägg till, ändra och ta bort. */
function ReservationsCard({ kurs, participants, onChange }: { kurs: Kurs; participants: Participant[]; onChange: () => Promise<void> }) {
  const { schools, places, addSchool } = useReservationData();
  const courseDate = new Date(kurs.startTime).toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' });
  const [editing, setEditing] = useState<{ draft: ReservationDraft; isNew: boolean } | null>(null);
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const reservations = kurs.schoolAllocations;
  const reserved = reservations.reduce((s, r) => s + r.seats, 0);
  const publicBooked = participants.filter(p => p.status !== 'Canceled' && !p.schoolName).length;
  const freePublic = Math.max(0, kurs.seatLimit - reserved - publicBooked);
  const ymd = (iso: string) => new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' });

  const startEdit = (r: Reservation | null) => {
    setError('');
    setNotify(true);
    setEditing(r
      ? {
          isNew: false,
          draft: {
            key: String(r.schoolUserId), schoolUserId: String(r.schoolUserId), seats: String(r.seats),
            fillBy: r.fillBy ? ymd(r.fillBy) : '', fillByAuto: false, meetingPlace: r.meetingPlace, message: r.message,
          },
        }
      : { isNew: true, draft: newReservation(courseDate) });
  };

  const save = async () => {
    if (!editing) return;
    setBusy(true);
    setError('');
    const res = await fetch(`/api/admin/kurser/${kurs.id}/reservationer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...reservationPayload(editing.draft), notify }),
    });
    setBusy(false);
    if (!res.ok) { setError((await res.json()).error ?? 'Kunde inte spara'); return; }
    setEditing(null);
    await onChange();
  };

  const remove = async (r: Reservation) => {
    if (!confirm(`Ta bort reservationen för ${r.name}? De ${r.seats} platserna blir publika igen.`)) return;
    const res = await fetch(`/api/admin/kurser/${kurs.id}/reservationer?schoolUserId=${r.schoolUserId}`, { method: 'DELETE' });
    if (!res.ok) { alert((await res.json()).error ?? 'Kunde inte ta bort'); return; }
    await onChange();
  };

  const editedSchool = editing ? reservations.find(r => String(r.schoolUserId) === editing.draft.schoolUserId) : undefined;
  const maxSeats = Math.max(1, kurs.seatLimit - (reserved - (editedSchool?.seats ?? 0)) - publicBooked);

  return (
    <Card title="Trafikskolor">
      <p className="text-sm text-white/60 mb-4">
        {kurs.seatLimit} platser: <strong className="text-white">{reserved} reserverade</strong> · {publicBooked} bokade av elever · <strong className="text-white">{freePublic} lediga publika</strong>
      </p>

      {reservations.length > 0 && (
        <div className="space-y-3 mb-4">
          {reservations.map(r => (editing && !editing.isNew && editing.draft.schoolUserId === String(r.schoolUserId) ? null : (
            <div key={r.schoolUserId} className="rounded-2xl bg-white/5 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold truncate">{r.name}</p>
                  <p className="text-sm text-white/60">
                    {r.used} av {r.seats} platser fyllda
                    {r.releasedAt
                      ? ` · outnyttjade släpptes ${formatDate(r.releasedAt, { day: 'numeric', month: 'short' })}`
                      : r.fillBy ? ` · fyll senast ${formatDate(r.fillBy, { day: 'numeric', month: 'short' })}` : ' · ingen sista dag'}
                  </p>
                </div>
                {r.releasedAt ? <Badge>Släppt</Badge> : r.used >= r.seats ? <Badge tone="green">Fullt</Badge> : null}
              </div>
              <div className="h-1.5 rounded-full bg-white/10 mt-3 overflow-hidden">
                <div className="h-full bg-sky-400 rounded-full" style={{ width: `${r.seats ? Math.min(100, (r.used / r.seats) * 100) : 0}%` }} />
              </div>
              <p className="text-sm text-white/60 mt-3">📍 {r.meetingPlace || 'Kursens mötesplats'}</p>
              {r.message && <p className="text-sm text-white/60 mt-1 whitespace-pre-wrap">💬 {r.message}</p>}
              <p className="text-xs text-white/40 mt-1">{r.notifiedAt ? `Mejlat ${formatDate(r.notifiedAt, { day: 'numeric', month: 'short' })} till ${r.email}` : 'Inget mejl skickat'}</p>
              <div className="flex gap-2 mt-3">
                <Button className="!h-9" onClick={() => startEdit(r)} disabled={!!editing}>Ändra</Button>
                <Button variant="danger" className="!h-9" onClick={() => remove(r)} disabled={!!editing}>Ta bort</Button>
              </div>
            </div>
          )))}
        </div>
      )}

      {editing ? (
        <div className="rounded-2xl border border-white/10 p-4">
          <p className="font-bold mb-4">{editing.isNew ? 'Reservera platser åt en trafikskola' : `Ändra reservation – ${editedSchool?.name ?? ''}`}</p>
          <ReservationFields
            value={editing.draft}
            onChange={draft => setEditing({ ...editing, draft })}
            schools={schools}
            places={places}
            onSchoolCreated={addSchool}
            maxSeats={maxSeats}
            takenSchoolIds={editing.isNew ? reservations.map(r => String(r.schoolUserId)) : []}
            lockSchool={!editing.isNew}
          />
          <div className="mt-4">
            <Checkbox checked={notify} onChange={setNotify}>{editing.isNew ? 'Mejla skolan om platserna' : 'Mejla skolan om de får fler platser'}</Checkbox>
          </div>
          {error && <p className="text-sm text-red-400 mt-3">{error}</p>}
          <div className="flex gap-2 mt-4">
            <Button onClick={() => setEditing(null)} disabled={busy}>Avbryt</Button>
            <Button variant="primary" className="flex-1" onClick={save} disabled={busy || !editing.draft.schoolUserId}>
              {busy ? 'Sparar…' : editing.isNew ? 'Reservera' : 'Spara'}
            </Button>
          </div>
          {editing.isNew && <p className="text-xs text-white/50 mt-3">Skolan får ett mejl och ser platserna direkt. De som inte fyllts släpps automatiskt efter &quot;fyll senast&quot;.</p>}
        </div>
      ) : (
        kurs.status !== 'canceled' && (
          <button
            type="button"
            onClick={() => startEdit(null)}
            disabled={freePublic === 0}
            className="w-full h-11 rounded-full border border-dashed border-white/20 text-sm font-semibold text-white/70 hover:text-white hover:border-white/40 disabled:opacity-40"
          >
            {freePublic === 0 ? 'Inga lediga platser att reservera' : '+ Reservera platser åt en trafikskola'}
          </button>
        )
      )}
    </Card>
  );
}
