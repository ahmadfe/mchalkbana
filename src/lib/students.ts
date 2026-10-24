import type { Prisma, Student } from '@prisma/client';
import { prisma } from './db';
import {
  ageFromPersonnummer,
  decryptPersonnummer,
  encryptPersonnummer,
  formatPersonnummer,
  hashPersonnummer,
  normalizePersonnummer,
} from './personnummer';

const DATE_FIELDS = ['permitValidUntil', 'synintygDate', 'risk1DoneAt', 'risk2DoneAt'] as const;
const TEXT_FIELDS = ['firstName', 'lastName', 'email', 'phone', 'address', 'postalCode', 'city', 'behorighet', 'notes'] as const;

export function toStudentDto(s: Student) {
  let pnr: string | null = null;
  try { pnr = decryptPersonnummer(s.personnummerEnc); } catch { /* nyckel saknas eller fel */ }
  const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : '');
  return {
    id: s.id,
    firstName: s.firstName,
    lastName: s.lastName,
    name: `${s.firstName} ${s.lastName}`.trim(),
    personnummer: pnr ? formatPersonnummer(pnr) : '',
    age: pnr ? ageFromPersonnummer(pnr) : null,
    email: s.email,
    phone: s.phone,
    address: s.address,
    postalCode: s.postalCode,
    city: s.city,
    behorighet: s.behorighet,
    status: s.status,
    filialId: s.filialId,
    permitValidUntil: iso(s.permitValidUntil),
    synintygDate: iso(s.synintygDate),
    risk1DoneAt: iso(s.risk1DoneAt),
    risk2DoneAt: iso(s.risk2DoneAt),
    gdprInformed: !!s.gdprInformedAt,
    notes: s.notes,
    createdAt: s.createdAt.toISOString(),
  };
}

export type StudentDto = ReturnType<typeof toStudentDto>;

/** Tolkar formulärdata från admin. Returnerar fel som text eller data att spara. */
export function parseStudentInput(
  body: Record<string, unknown>,
  { partial }: { partial: boolean },
): { error: string } | { data: Prisma.StudentUncheckedUpdateInput; pnr?: string } {
  const data: Prisma.StudentUncheckedUpdateInput = {};
  for (const f of TEXT_FIELDS) {
    if (body[f] !== undefined) data[f] = String(body[f] ?? '').trim();
  }
  for (const f of DATE_FIELDS) {
    if (body[f] === undefined) continue;
    const v = String(body[f] ?? '');
    if (v && isNaN(Date.parse(v))) return { error: 'Ogiltigt datum' };
    data[f] = v ? new Date(v) : null;
  }
  if (body.status !== undefined) data.status = body.status === 'archived' ? 'archived' : 'active';
  if (body.filialId !== undefined) data.filialId = body.filialId ? Number(body.filialId) : null;
  if (body.gdprInformed !== undefined) data.gdprInformedAt = body.gdprInformed ? new Date() : null;

  // Importerade elever kan sakna efternamn, så det krävs bara när en ny elev skapas.
  if ((!partial || data.firstName !== undefined) && !data.firstName) return { error: 'Förnamn krävs' };
  if (!partial && !data.lastName) return { error: 'För- och efternamn krävs' };

  let pnr: string | undefined;
  if (!partial || body.personnummer !== undefined) {
    const n = normalizePersonnummer(String(body.personnummer ?? ''));
    if (!n) return { error: 'Ogiltigt personnummer (ÅÅÅÅMMDD-XXXX)' };
    pnr = n;
    data.personnummerHash = hashPersonnummer(n);
    data.personnummerEnc = encryptPersonnummer(n);
  }
  return { data, pnr };
}

export { courseKind, type CourseKind } from './courseKind';

export function splitName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/);
  return { firstName: parts[0] ?? '', lastName: parts.slice(1).join(' ') };
}

/**
 * Kopplar en bokning till en elev i elevregistret (matchat på personnummer) och skapar eleven om den saknas.
 * Får aldrig stoppa en bokning – fel loggas bara.
 */
export async function linkBookingToStudent(bookingId: number): Promise<void> {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { session: { select: { schoolId: true } }, user: true },
    });
    if (!booking || booking.studentId) return;
    const pnr = normalizePersonnummer(booking.personnummer);
    if (!pnr) return;

    const hash = hashPersonnummer(pnr);
    const name = splitName(booking.guestName ?? booking.user?.name ?? '');
    const student = await prisma.student.upsert({
      where: { personnummerHash: hash },
      update: {},
      create: {
        ...name,
        personnummerHash: hash,
        personnummerEnc: encryptPersonnummer(pnr),
        email: booking.guestEmail ?? booking.user?.email ?? '',
        phone: booking.guestPhone ?? booking.user?.phone ?? '',
        filialId: booking.session.schoolId,
      },
    });
    await prisma.booking.update({ where: { id: bookingId }, data: { studentId: student.id } });
  } catch (err) {
    console.error('linkBookingToStudent failed', bookingId, err);
  }
}

type BookingForArchive = { status: string; session: { endTime: Date; status: string } };

/** Kurser som är inställda eller avbokade räknas inte. */
const countsAsCourse = (b: BookingForArchive) => b.status !== 'Canceled' && b.session.status !== 'canceled';
const isDone = (b: BookingForArchive, now: Date) => b.session.status === 'completed' || b.session.endTime < now;

/**
 * Arkiverad = manuellt arkiverad, eller har gått kurser och har inga kommande kvar.
 * En ny bokning gör eleven aktiv igen automatiskt.
 */
export function archiveState(student: { status: string }, bookings: BookingForArchive[], now = new Date()): 'active' | 'archived' | 'done' {
  if (student.status === 'archived') return 'archived';
  const courses = bookings.filter(countsAsCourse);
  return courses.length > 0 && courses.every(b => isDone(b, now)) ? 'done' : 'active';
}

/** Prisma-filter för elever som räknas som aktiva (för antal i översikten). */
export function activeStudentWhere(now = new Date()) {
  return {
    status: 'active',
    OR: [
      { bookings: { none: { status: { not: 'Canceled' }, session: { status: { not: 'canceled' } } } } },
      { bookings: { some: { status: { not: 'Canceled' }, session: { status: { notIn: ['canceled', 'completed'] }, endTime: { gte: now } } } } },
    ],
  };
}
