import { prisma } from './db';
import type { JWTPayload } from './auth';
import { courseKind } from './courseKind';
import { encryptPersonnummer, formatPersonnummer, normalizePersonnummer } from './personnummer';
import { linkBookingToStudent } from './students';

export const ID_TYPES = ['korkort', 'pass', 'nationellt_id', 'id_kort'] as const;
export type IdType = (typeof ID_TYPES)[number];

type Result = { ok: true } | { ok: false; status: number; error: string };

/** Admin får checka in på alla kurser, lärare bara på kurser de är tilldelade. */
export async function canCheckIn(user: JWTPayload | null, sessionId: number): Promise<boolean> {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (user.role !== 'instructor') return false;
  const assigned = await prisma.session.count({ where: { id: sessionId, assignedSchoolUsers: { some: { id: user.userId } } } });
  return assigned > 0;
}

/**
 * Checkar in en deltagare: sparar vilken legitimation som visades, markerar närvaro,
 * skriver en rad i riskregistret och fyller i elevens datum för riskutbildningen.
 */
export async function checkIn(bookingId: number, user: JWTPayload, idType: string, personnummerInput?: string): Promise<Result> {
  if (!ID_TYPES.includes(idType as IdType)) return { ok: false, status: 400, error: 'Välj legitimation' };

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { session: { include: { course: true } }, user: { select: { name: true } } },
  });
  if (!booking) return { ok: false, status: 404, error: 'Bokningen hittades inte' };
  if (!(await canCheckIn(user, booking.sessionId))) return { ok: false, status: 403, error: 'Ej behörig' };
  if (booking.status === 'Canceled') return { ok: false, status: 400, error: 'Bokningen är avbokad' };
  if (booking.session.status === 'canceled') return { ok: false, status: 400, error: 'Kursen är inställd' };
  if (booking.checkedInAt) return { ok: false, status: 409, error: 'Deltagaren är redan incheckad' };

  // Personnumret kan rättas vid incheckningen om det saknas eller var fel
  const corrected = personnummerInput ? normalizePersonnummer(personnummerInput) : null;
  if (personnummerInput && !corrected) return { ok: false, status: 400, error: 'Ogiltigt personnummer (ÅÅÅÅMMDD-XXXX)' };
  const pnr = corrected ?? normalizePersonnummer(booking.personnummer);
  if (!pnr) return { ok: false, status: 400, error: 'Personnummer saknas – fyll i det från legitimationen' };
  const pnrChanged = pnr !== normalizePersonnummer(booking.personnummer);

  const kind = courseKind(booking.session.course.type);
  const isRisk = kind !== 'other';
  let personnummerEnc: string;
  try {
    personnummerEnc = encryptPersonnummer(pnr);
  } catch {
    return { ok: false, status: 500, error: 'Krypteringsnyckeln (ENCRYPTION_KEY) saknas på servern' };
  }

  const now = new Date();
  await prisma.$transaction([
    prisma.booking.update({
      where: { id: bookingId },
      data: {
        checkedInAt: now,
        checkedInById: user.userId,
        idType,
        attendance: 'attended',
        ...(pnrChanged ? { personnummer: formatPersonnummer(pnr), studentId: null } : {}),
      },
    }),
    ...(isRisk ? [prisma.riskRegisterEntry.create({
      data: {
        bookingId,
        studentId: pnrChanged ? null : booking.studentId,
        sessionId: booking.sessionId,
        courseType: booking.session.course.type,
        courseTitle: booking.session.course.titleSv,
        sessionDate: booking.session.startTime,
        studentName: booking.guestName || booking.user?.name || '',
        personnummerEnc,
        idType,
        checkedInAt: now,
        checkedInById: user.userId,
        checkedInByName: user.name,
      },
    })] : []),
  ]);

  // Koppla till elevregistret (nytt personnummer kan betyda en annan elev) och uppdatera milstolparna
  await linkBookingToStudent(bookingId);
  const linked = await prisma.booking.findUnique({ where: { id: bookingId }, select: { studentId: true } });
  if (linked?.studentId) {
    if (pnrChanged) await prisma.riskRegisterEntry.updateMany({ where: { bookingId }, data: { studentId: linked.studentId } });
    const date = booking.session.startTime;
    const student = await prisma.student.findUnique({ where: { id: linked.studentId } });
    if (student) {
      await prisma.student.update({
        where: { id: student.id },
        data: {
          ...((kind === 'risk1' || kind === 'kombo') && !student.risk1DoneAt ? { risk1DoneAt: date } : {}),
          ...((kind === 'risk2' || kind === 'kombo') && !student.risk2DoneAt ? { risk2DoneAt: date } : {}),
        },
      });
    }
  }
  return { ok: true };
}

/** Ångrar en incheckning (t.ex. fel person eller fel legitimation). */
export async function undoCheckIn(bookingId: number, user: JWTPayload): Promise<Result> {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, include: { session: true } });
  if (!booking) return { ok: false, status: 404, error: 'Bokningen hittades inte' };
  if (!(await canCheckIn(user, booking.sessionId))) return { ok: false, status: 403, error: 'Ej behörig' };
  if (!booking.checkedInAt) return { ok: true };

  await prisma.$transaction([
    prisma.booking.update({
      where: { id: bookingId },
      data: { checkedInAt: null, checkedInById: null, idType: null, attendance: 'registered' },
    }),
    prisma.riskRegisterEntry.deleteMany({ where: { bookingId } }),
  ]);

  // Ta bara bort milstolpen om den kom från just den här kursen
  if (booking.studentId) {
    const date = booking.session.startTime;
    await prisma.student.updateMany({ where: { id: booking.studentId, risk1DoneAt: date }, data: { risk1DoneAt: null } });
    await prisma.student.updateMany({ where: { id: booking.studentId, risk2DoneAt: date }, data: { risk2DoneAt: null } });
  }
  return { ok: true };
}
