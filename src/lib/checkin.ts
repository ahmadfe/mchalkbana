import { prisma } from './db';
import type { JWTPayload } from './auth';
import { bookingParts, courseKind, isComboParts } from './courseKind';
import { encryptPersonnummer, formatPersonnummer, normalizePersonnummer } from './personnummer';
import { linkBookingToStudent } from './students';

export const ID_TYPES = ['korkort', 'pass', 'nationellt_id', 'id_kort'] as const;
export type IdType = (typeof ID_TYPES)[number];

type Result = { ok: true } | { ok: false; status: number; error: string };

/** Kurstyp i riskregistret för en del av en kombokurs */
const PART_TYPE = { risk1: 'Risk 1', risk2: 'Risk 2' } as const;

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
/**
 * "Incheckad av" är alltid kursens tilldelade lärare, oavsett vem som klickade.
 * Utan lärare går det inte att checka in. Har kursen flera lärare används den som klickade
 * om hen är en av dem, annars den admin valt.
 */
async function pickInstructor(sessionId: number, user: JWTPayload, chosenId?: number): Promise<{ id: number; name: string } | { error: string }> {
  const instructors = await prisma.user.findMany({
    where: { role: 'instructor', assignedSessions: { some: { id: sessionId } } },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
  if (instructors.length === 0) return { error: 'Kursen har ingen lärare tilldelad – tilldela en lärare innan du checkar in' };
  const self = instructors.find(i => i.id === user.userId);
  if (self) return self;
  if (chosenId) {
    const chosen = instructors.find(i => i.id === chosenId);
    if (!chosen) return { error: 'Den valda läraren är inte tilldelad kursen' };
    return chosen;
  }
  if (instructors.length === 1) return instructors[0];
  return { error: 'Välj vilken lärare som checkar in' };
}

export async function checkIn(bookingId: number, user: JWTPayload, idType: string, personnummerInput?: string, instructorId?: number): Promise<Result> {
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
  const instructor = await pickInstructor(booking.sessionId, user, instructorId);
  if ('error' in instructor) return { ok: false, status: 400, error: instructor.error };

  // Personnumret kan rättas vid incheckningen om det saknas eller var fel
  const corrected = personnummerInput ? normalizePersonnummer(personnummerInput) : null;
  if (personnummerInput && !corrected) return { ok: false, status: 400, error: 'Ogiltigt personnummer (ÅÅÅÅMMDD-XXXX)' };
  const pnr = corrected ?? normalizePersonnummer(booking.personnummer);
  if (!pnr) return { ok: false, status: 400, error: 'Personnummer saknas – fyll i det från legitimationen' };
  const pnrChanged = pnr !== normalizePersonnummer(booking.personnummer);

  const kind = courseKind(booking.session.course.type);
  // Kombokurs: en rad per del eleven gör (Risk 1 och/eller Risk 2)
  const parts = bookingParts(booking.session.course.type, booking.comboParts);
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
        checkInInstructorId: instructor.id,
        checkInInstructorName: instructor.name,
        attendance: 'attended',
        ...(pnrChanged ? { personnummer: formatPersonnummer(pnr), studentId: null } : {}),
      },
    }),
    ...parts.map(part => prisma.riskRegisterEntry.create({
      data: {
        bookingId,
        studentId: pnrChanged ? null : booking.studentId,
        sessionId: booking.sessionId,
        courseType: kind === 'kombo' ? PART_TYPE[part] : booking.session.course.type,
        courseTitle: booking.session.course.titleSv,
        sessionDate: booking.session.startTime,
        studentName: booking.guestName || booking.user?.name || '',
        personnummerEnc,
        idType,
        checkedInAt: now,
        checkedInById: user.userId,
        checkedInByName: user.name,
        instructorId: instructor.id,
        instructorName: instructor.name,
      },
    })),
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
          ...(parts.includes('risk1') && !student.risk1DoneAt ? { risk1DoneAt: date } : {}),
          ...(parts.includes('risk2') && !student.risk2DoneAt ? { risk2DoneAt: date } : {}),
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
      data: { checkedInAt: null, checkedInById: null, idType: null, checkInInstructorId: null, checkInInstructorName: null, attendance: 'registered' },
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

// ── Vilken trafikskola som betalar för eleven (väljs av admin i betalningssteget på kurssidan) ──

export interface SchoolChoice {
  /** Skolan som betalar för eleven, null = privat */
  schoolUserId: number | null;
  /** Varför valet inte går att ändra, annars null */
  locked: string | null;
}

/** Nuvarande skola och om den går att ändra (betald med Swish eller redan fakturerad = låst). */
export function schoolChoiceFor(booking: { bookedBySchoolUserId: number | null; invoiceId: number | null; payment: { status: string } | null; schoolCredits?: unknown[] }): SchoolChoice {
  // Bara en genomförd betalning låser (betalningar skapas först när de har gått igenom)
  const paid = booking.payment?.status === 'Succeeded';
  return {
    schoolUserId: booking.bookedBySchoolUserId,
    locked: booking.invoiceId ? 'Eleven finns redan på en faktura'
      : paid ? 'Eleven har betalat själv med Swish'
      : booking.schoolCredits?.length ? 'Eleven har betalat en del – ta bort elevens betalning först'
      : null,
  };
}

/**
 * Flyttar eleven till en trafikskola (skolan faktureras) eller tillbaka till privat.
 * Kvoten för skolans platser gäller inte här – eleven sitter redan på kursen.
 */
export async function setBookingSchool(bookingId: number, user: JWTPayload, schoolUserId: number | null): Promise<Result> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, sessionId: true, status: true, bookedBySchoolUserId: true, invoiceId: true, payment: { select: { status: true } }, schoolCredits: { select: { id: true } } },
  });
  if (!booking) return { ok: false, status: 404, error: 'Bokningen hittades inte' };
  if (user.role !== 'admin') return { ok: false, status: 403, error: 'Bara admin kan välja trafikskola' };
  if (booking.bookedBySchoolUserId === schoolUserId) return { ok: true };
  const choice = schoolChoiceFor(booking);
  if (choice.locked) return { ok: false, status: 400, error: choice.locked };
  if (schoolUserId !== null) {
    const school = await prisma.user.findFirst({ where: { id: schoolUserId, role: 'school', disabled: false }, select: { id: true } });
    if (!school) return { ok: false, status: 400, error: 'Trafikskolan finns inte eller är inaktiverad' };
  }
  await prisma.booking.update({
    where: { id: bookingId },
    data: {
      bookedBySchoolUserId: schoolUserId,
      // En skola betalar via faktura – en obetald privatbokning blir då bekräftad
      ...(schoolUserId !== null && booking.status === 'Pending' ? { status: 'Confirmed' } : {}),
    },
  });
  const { recalcSeats } = await import('./kurser');
  await recalcSeats(booking.sessionId);
  return { ok: true };
}

// ── Kombokurs: vilka delar eleven gör ──

/**
 * Ändrar delarna (Risk 1 + 2 / bara Risk 1 / bara Risk 2) för en bokning på en kombokurs.
 * Är eleven redan incheckad följer riskregistret och elevens datum för Risk 1/Risk 2 med.
 */
export async function setComboParts(bookingId: number, comboParts: string): Promise<Result> {
  if (!isComboParts(comboParts)) return { ok: false, status: 400, error: 'Ogiltigt val av delar' };
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { session: { include: { course: true } } },
  });
  if (!booking) return { ok: false, status: 404, error: 'Bokningen hittades inte' };
  if (courseKind(booking.session.course.type) !== 'kombo') return { ok: false, status: 400, error: 'Delar kan bara väljas på kombokurser' };
  if (booking.comboParts === comboParts) return { ok: true };

  await prisma.booking.update({ where: { id: bookingId }, data: { comboParts } });
  const entries = booking.checkedInAt ? await prisma.riskRegisterEntry.findMany({ where: { bookingId } }) : [];
  if (entries.length === 0) return { ok: true };

  // Incheckad: lägg till eller ta bort rader i riskregistret så att de matchar delarna
  const wanted = bookingParts(booking.session.course.type, comboParts);
  const partOf = (type: string) => courseKind(type) === 'risk1' ? 'risk1' : 'risk2';
  const template = entries[0];
  const remove = entries.filter(e => !wanted.includes(partOf(e.courseType)));
  const add = wanted.filter(p => !entries.some(e => partOf(e.courseType) === p));
  const { id: _id, createdAt: _createdAt, ...copy } = template;
  await prisma.$transaction([
    prisma.riskRegisterEntry.deleteMany({ where: { id: { in: remove.map(e => e.id) } } }),
    ...add.map(p => prisma.riskRegisterEntry.create({ data: { ...copy, courseType: PART_TYPE[p] } })),
  ]);

  if (booking.studentId) {
    const date = booking.session.startTime;
    const has = (p: 'risk1' | 'risk2') => wanted.includes(p);
    // Ta bara bort datum som kom från just den här kursen
    if (!has('risk1')) await prisma.student.updateMany({ where: { id: booking.studentId, risk1DoneAt: date }, data: { risk1DoneAt: null } });
    if (!has('risk2')) await prisma.student.updateMany({ where: { id: booking.studentId, risk2DoneAt: date }, data: { risk2DoneAt: null } });
    if (has('risk1')) await prisma.student.updateMany({ where: { id: booking.studentId, risk1DoneAt: null }, data: { risk1DoneAt: date } });
    if (has('risk2')) await prisma.student.updateMany({ where: { id: booking.studentId, risk2DoneAt: null }, data: { risk2DoneAt: date } });
  }
  return { ok: true };
}
