import crypto from 'crypto';
import { SignJWT, jwtVerify } from 'jose';
import { prisma } from './db';
import { courseKind, COURSE_KIND_LABEL } from './courseKind';
import { decryptPersonnummer, formatPersonnummer, normalizePersonnummer } from './personnummer';

/** Digital incheckning infördes då – äldre kurser saknar incheckning och räknas inte som brist. */
export const CHECKIN_REQUIRED_FROM = new Date('2026-10-25T00:00:00+02:00');
const CODE_TTL_MS = 10 * 60_000;
const TOKEN_TTL = '15m';
const MAX_ATTEMPTS = 5;

const secret = () => new TextEncoder().encode(process.env.JWT_SECRET || 'uppsalahalkbana-secret-key-change-in-production');
const hashCode = (userId: number, code: string) => crypto.createHash('sha256').update(`${userId}:${code}`).digest('hex');

// ── Period ──────────────────────────────────────────────────────────────

export interface Period { label: string; from: Date; to: Date }

/** "2026" eller "2025-2026" → kalenderår i svensk tid. */
export function parsePeriod(raw: string | null): Period | null {
  const m = (raw ?? '').match(/^(\d{4})(?:-(\d{4}))?$/);
  if (!m) return null;
  const first = Number(m[1]);
  const last = Number(m[2] ?? m[1]);
  if (last < first || last - first > 5) return null;
  return {
    label: first === last ? String(first) : `${first}–${last}`,
    from: new Date(`${first}-01-01T00:00:00+01:00`),
    to: new Date(`${last + 1}-01-01T00:00:00+01:00`),
  };
}

// ── Engångskod och nedladdningsbiljett ─────────────────────────────────

export async function createExportCode(userId: number): Promise<{ code: string } | { error: string }> {
  const recent = await prisma.exportCode.findFirst({ where: { userId, createdAt: { gt: new Date(Date.now() - 30_000) } } });
  if (recent) return { error: 'Vänta en halv minut innan du ber om en ny kod' };
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  await prisma.exportCode.create({ data: { userId, codeHash: hashCode(userId, code), expiresAt: new Date(Date.now() + CODE_TTL_MS) } });
  return { code };
}

/** Kontrollerar koden och lämnar ut en biljett som gäller för nedladdningar i 15 minuter. */
export async function verifyExportCode(userId: number, code: string): Promise<{ token: string } | { error: string }> {
  const row = await prisma.exportCode.findFirst({
    where: { userId, usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });
  if (!row || row.attempts >= MAX_ATTEMPTS) return { error: 'Koden har gått ut – be om en ny' };
  if (row.codeHash !== hashCode(userId, code.replace(/\D/g, ''))) {
    await prisma.exportCode.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } });
    return { error: 'Fel kod' };
  }
  await prisma.exportCode.update({ where: { id: row.id }, data: { usedAt: new Date() } });
  const token = await new SignJWT({ userId, scope: 'tillsyn' }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime(TOKEN_TTL).sign(secret());
  return { token };
}

export async function verifyExportToken(token: string | null, userId: number): Promise<boolean> {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload.scope === 'tillsyn' && payload.userId === userId;
  } catch {
    return false;
  }
}

// ── Översikt och brister ────────────────────────────────────────────────

export interface Issue { kind: 'unreported' | 'missing_pnr' | 'no_checkin' | 'attendance'; sessionId: number; text: string; date: string }

const dateSv = (d: Date) => d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' });

export async function tillsynOverview(period: Period) {
  const now = new Date();
  const sessions = await prisma.session.findMany({
    where: { startTime: { gte: period.from, lt: period.to }, status: { not: 'canceled' } },
    include: {
      course: { select: { titleSv: true, type: true } },
      bookings: {
        where: { status: { not: 'Canceled' } },
        select: { id: true, studentId: true, guestName: true, personnummer: true, attendance: true, checkedInAt: true },
      },
    },
    orderBy: { startTime: 'asc' },
  });
  const done = sessions.filter(s => s.endTime < now);

  const students = new Set<string>();
  let completedCourses = 0;
  const issues: Issue[] = [];
  for (const s of done) {
    const label = `${s.course.titleSv} ${dateSv(s.startTime)}`;
    const base = { sessionId: s.id, date: s.startTime.toISOString() };
    const present = s.bookings.filter(b => b.attendance !== 'no_show' && b.attendance !== 'late_cancel');
    present.forEach(b => students.add(b.studentId ? `s${b.studentId}` : `b${b.id}`));
    if (present.length > 0) completedCourses++;

    if (s.reportToTS && !s.reportedAt && present.length > 0) issues.push({ ...base, kind: 'unreported', text: `${label} är inte rapporterad till Transportstyrelsen` });
    const noPnr = present.filter(b => !normalizePersonnummer(b.personnummer));
    if (noPnr.length) issues.push({ ...base, kind: 'missing_pnr', text: `${label}: ${noPnr.map(b => b.guestName || 'okänd').join(', ')} saknar giltigt personnummer` });
    if (s.startTime >= CHECKIN_REQUIRED_FROM) {
      const unmarked = s.bookings.filter(b => b.attendance === 'registered').length;
      if (unmarked) issues.push({ ...base, kind: 'attendance', text: `${label}: ${unmarked} deltagare saknar närvaro (deltog/uteblev)` });
      const noCheckin = s.bookings.filter(b => b.attendance === 'attended' && !b.checkedInAt).length;
      if (noCheckin) issues.push({ ...base, kind: 'no_checkin', text: `${label}: ${noCheckin} deltog utan incheckning (legitimation ej kontrollerad)` });
    }
  }

  const riskEntries = await prisma.riskRegisterEntry.count({ where: { sessionDate: { gte: period.from, lt: period.to } } });
  return {
    period: period.label,
    students: students.size,
    completedCourses,
    plannedCourses: sessions.length - done.length,
    riskEntries,
    issues,
    legacyUnreported: issues.filter(i => i.kind === 'unreported' && new Date(i.date) < CHECKIN_REQUIRED_FROM).length,
  };
}

// ── Register ────────────────────────────────────────────────────────────

const ID_LABEL: Record<string, string> = { korkort: 'Körkort', pass: 'Pass', nationellt_id: 'Nationellt id-kort', id_kort: 'Id-kort (godkänt)' };
const ATTENDANCE_LABEL: Record<string, string> = { registered: 'Anmäld', attended: 'Deltog', no_show: 'Uteblev', late_cancel: 'Sen avanmälan' };
const fmtPnr = (raw: string | null) => { const n = normalizePersonnummer(raw); return n ? formatPersonnummer(n) : (raw ?? ''); };
const decrypt = (enc: string | null) => { try { const p = decryptPersonnummer(enc); return p ? formatPersonnummer(p) : ''; } catch { return ''; } };
const hm = (d: Date) => d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Stockholm' });

export type Table = { title: string; columns: string[]; rows: string[][] };

/** Elevregister: alla elever som gått en kurs under perioden, med kurserna. */
export async function elevregister(period: Period): Promise<Table> {
  const bookings = await prisma.booking.findMany({
    where: { status: { not: 'Canceled' }, session: { startTime: { gte: period.from, lt: period.to }, status: { not: 'canceled' } } },
    include: { session: { include: { course: true, school: true } }, student: true },
    orderBy: { session: { startTime: 'asc' } },
  });
  const byStudent = new Map<string, typeof bookings>();
  for (const b of bookings) {
    const key = b.studentId ? `s${b.studentId}` : `b${b.id}`;
    byStudent.set(key, [...(byStudent.get(key) ?? []), b]);
  }
  const rows = Array.from(byStudent.values()).map(list => {
    const b = list[0];
    const s = b.student;
    const name = s ? `${s.firstName} ${s.lastName}`.trim() : b.guestName ?? '';
    return [
      name,
      s ? decrypt(s.personnummerEnc) || fmtPnr(b.personnummer) : fmtPnr(b.personnummer),
      s?.behorighet ?? b.session.course.behorighet,
      dateSv(new Date(Math.min(s ? s.createdAt.getTime() : Infinity, ...list.map(x => x.bookingTime.getTime())))),
      s?.risk1DoneAt ? dateSv(s.risk1DoneAt) : '',
      s?.risk2DoneAt ? dateSv(s.risk2DoneAt) : '',
      list.map(x => `${dateSv(x.session.startTime)} ${COURSE_KIND_LABEL[courseKind(x.session.course.type)]} (${ATTENDANCE_LABEL[x.attendance] ?? x.attendance}${x.idType ? `, ${ID_LABEL[x.idType]?.toLowerCase()}` : ''})`).join('; '),
      b.session.school.name,
    ];
  }).sort((a, b) => a[0].localeCompare(b[0], 'sv'));
  return {
    title: `Elevregister ${period.label}`,
    columns: ['Namn', 'Personnummer', 'Behörighet', 'Registrerad', 'Risk 1 gjord', 'Risk 2 gjord', 'Kurser under perioden', 'Filial'],
    rows,
  };
}

/** Kursregister: varje kurstillfälle under perioden med lärare, närvaro och rapportering. */
export async function kursregister(period: Period): Promise<Table> {
  const sessions = await prisma.session.findMany({
    where: { startTime: { gte: period.from, lt: period.to } },
    include: {
      course: true,
      school: true,
      assignedSchoolUsers: { where: { role: 'instructor' }, select: { name: true } },
      bookings: { where: { status: { not: 'Canceled' } }, select: { attendance: true, checkedInAt: true } },
    },
    orderBy: { startTime: 'asc' },
  });
  return {
    title: `Kursregister ${period.label}`,
    columns: ['Datum', 'Tid', 'Kurs', 'Typ', 'Filial', 'Lärare', 'Anmälda', 'Deltog', 'Incheckade', 'Status', 'Rapporterad'],
    rows: sessions.map(s => [
      dateSv(s.startTime),
      `${hm(s.startTime)}–${hm(s.endTime)}`,
      s.course.titleSv,
      COURSE_KIND_LABEL[courseKind(s.course.type)],
      s.school.name,
      s.assignedSchoolUsers.map(u => u.name).join(', '),
      String(s.bookings.length),
      String(s.bookings.filter(b => b.attendance === 'attended').length),
      String(s.bookings.filter(b => b.checkedInAt).length),
      s.status === 'canceled' ? 'Inställd' : s.status === 'completed' ? 'Genomförd' : s.endTime < new Date() ? 'Ej markerad genomförd' : 'Planerad',
      !s.reportToTS ? 'Rapporteras ej' : s.reportedAt ? dateSv(s.reportedAt) : 'Nej',
    ]),
  };
}

/** Riskregister: varje incheckning de senaste fem åren – finns kvar även om eleven raderats. */
export async function riskregister(): Promise<Table> {
  const since = new Date();
  since.setFullYear(since.getFullYear() - 5);
  const entries = await prisma.riskRegisterEntry.findMany({ where: { sessionDate: { gte: since } }, orderBy: { sessionDate: 'asc' } });
  return {
    title: 'Riskregister (senaste fem åren)',
    columns: ['Kursdatum', 'Kurs', 'Typ', 'Namn', 'Personnummer', 'Legitimation', 'Incheckad', 'Incheckad av'],
    rows: entries.map(e => [
      dateSv(e.sessionDate),
      e.courseTitle,
      COURSE_KIND_LABEL[courseKind(e.courseType)],
      e.studentName,
      decrypt(e.personnummerEnc),
      ID_LABEL[e.idType] ?? e.idType,
      `${dateSv(e.checkedInAt)} ${hm(e.checkedInAt)}`,
      e.checkedInByName,
    ]),
  };
}

export function toCsv(t: Table): string {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  return '﻿' + [t.columns, ...t.rows].map(r => r.map(esc).join(';')).join('\r\n');
}

/**
 * Kurser före den digitala rapporteringen saknar datum för rapportering.
 * Admin kan markera dem som rapporterade i ett svep – datumet blir kursens slutdatum.
 */
export async function markLegacyReported(): Promise<number> {
  return prisma.$executeRaw`
    UPDATE "Session" SET "reportedAt" = "endTime"
    WHERE "reportedAt" IS NULL AND "reportToTS" = true AND "status" <> 'canceled'
      AND "endTime" < ${CHECKIN_REQUIRED_FROM} AND "endTime" < NOW()`;
}
