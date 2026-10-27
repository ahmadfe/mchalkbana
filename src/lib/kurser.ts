import { prisma } from './db';

/**
 * Räknar om lediga publika platser från grunden.
 * Samma regler som skolallokeringen: skolbokningar på publika pass tar av skolans kvot, inte av de publika platserna.
 */
export async function recalcSeats(sessionId: number): Promise<void> {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { seatLimit: true, visibility: true, schoolAllocations: { select: { allocatedSeats: true } } },
  });
  if (!session) return;
  const allocated = session.schoolAllocations.reduce((sum, a) => sum + a.allocatedSeats, 0);
  // Utan allokeringar tar alla bokningar plats; med allokeringar räknas bara de publika.
  const taken = await prisma.booking.count({
    where: { sessionId, status: { not: 'Canceled' }, ...(allocated > 0 ? { bookedBySchoolUserId: null } : {}) },
  });
  await prisma.session.update({
    where: { id: sessionId },
    data: { seatsAvailable: Math.max(0, session.seatLimit - allocated - taken) },
  });
}

/** Vad eleven ska betala: inbetalt belopp, annars skolpris, kampanjpris eller kursens pris. */
export function expectedPrice(
  booking: { bookedBySchoolUserId: number | null; payment: { amount: number } | null },
  session: { discountPrice: number | null; course: { price: number } },
  schoolPrices: Map<number, number>,
): number {
  if (booking.payment) return booking.payment.amount;
  if (booking.bookedBySchoolUserId) return schoolPrices.get(booking.bookedBySchoolUserId) ?? session.course.price;
  return session.discountPrice ?? session.course.price;
}

export const SESSION_STATUSES = ['planned', 'completed', 'canceled'] as const;
export const ATTENDANCE_VALUES = ['registered', 'attended', 'no_show', 'late_cancel'] as const;

export interface KursData {
  courseId?: number;
  schoolId?: number;
  startTime?: Date;
  endTime?: Date;
  seatLimit?: number;
  visibility?: string;
  reportToTS?: boolean;
  internalNotes?: string;
  receiptMessage?: string;
  meetingPlace?: string;
  discountPrice?: number | null;
  comboRisk1SessionId?: number | null;
  comboRisk2SessionId?: number | null;
}

const optionalId = (v: unknown) => (v ? Number(v) : null);

/** Tolkar formulärdata för ett kurstillfälle (Session). */
export async function parseKursInput(
  body: Record<string, unknown>,
  { partial }: { partial: boolean },
): Promise<{ error: string } | { data: KursData; instructorIds?: number[] }> {
  const data: KursData = {};
  const has = (k: string) => body[k] !== undefined;

  if (!partial || has('courseId')) {
    const course = body.courseId ? await prisma.course.findUnique({ where: { id: Number(body.courseId) }, select: { id: true } }) : null;
    if (!course) return { error: 'Välj kursslag' };
    data.courseId = course.id;
  }
  if (!partial || has('schoolId')) {
    const school = body.schoolId ? await prisma.school.findUnique({ where: { id: Number(body.schoolId) } }) : null;
    if (!school) return { error: 'Välj filial' };
    if (!partial && !school.active) return { error: 'Filialen är inaktiv' };
    data.schoolId = school.id;
  }
  if (!partial || has('startTime') || has('endTime')) {
    const start = new Date(String(body.startTime ?? ''));
    const end = new Date(String(body.endTime ?? ''));
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return { error: 'Ange datum, start och slut' };
    if (end <= start) return { error: 'Sluttiden måste vara efter starttiden' };
    data.startTime = start;
    data.endTime = end;
  }
  if (!partial || has('seatLimit')) {
    const seats = Number(body.seatLimit);
    if (!Number.isInteger(seats) || seats < 1 || seats > 500) return { error: 'Antal platser måste vara 1–500' };
    data.seatLimit = seats;
  }
  if (!partial || has('selfBooking')) data.visibility = body.selfBooking === false ? 'school' : 'public';
  if (!partial || has('reportToTS')) data.reportToTS = body.reportToTS !== false;
  if (has('internalNotes')) data.internalNotes = String(body.internalNotes ?? '');
  if (has('receiptMessage')) data.receiptMessage = String(body.receiptMessage ?? '');
  if (has('meetingPlace')) data.meetingPlace = String(body.meetingPlace ?? '').trim();
  if (has('discountPrice')) {
    const v = body.discountPrice;
    if (v === '' || v === null) data.discountPrice = null;
    else {
      const n = Number(v);
      if (!Number.isInteger(n) || n < 0) return { error: 'Ogiltigt pris' };
      data.discountPrice = n;
    }
  }
  if (has('comboRisk1SessionId')) data.comboRisk1SessionId = optionalId(body.comboRisk1SessionId);
  if (has('comboRisk2SessionId')) data.comboRisk2SessionId = optionalId(body.comboRisk2SessionId);

  let instructorIds: number[] | undefined;
  if (has('instructorIds')) {
    const ids = Array.isArray(body.instructorIds) ? body.instructorIds.map(Number).filter(Boolean) : [];
    const valid = await prisma.user.findMany({ where: { id: { in: ids }, role: 'instructor' }, select: { id: true } });
    instructorIds = valid.map(u => u.id);
  }
  return { data, instructorIds };
}

/** Datum, tid, plats och namn som e-postmallarna vill ha. */
export function courseEmailInfo(session: {
  startTime: Date;
  endTime: Date;
  meetingPlace: string;
  course: { titleSv: string; behorighet: string; location: string };
  school: { name: string };
}) {
  const tz = { timeZone: 'Europe/Stockholm' } as const;
  const hm = (d: Date) => d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', ...tz });
  return {
    courseName: `${session.course.titleSv} (${session.course.behorighet})`,
    courseDate: session.startTime.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', ...tz }),
    courseTime: `${hm(session.startTime)} – ${hm(session.endTime)}`,
    location: session.meetingPlace || session.course.location || session.school.name,
  };
}

/** Byter ut lärarna på ett pass men behåller skolor som är kopplade till det. */
export async function setInstructors(sessionId: number, instructorIds: number[]): Promise<void> {
  const current = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { assignedSchoolUsers: { where: { role: { not: 'instructor' } }, select: { id: true } } },
  });
  const keep = current?.assignedSchoolUsers.map(u => u.id) ?? [];
  const all = Array.from(new Set([...keep, ...instructorIds]));
  await prisma.session.update({ where: { id: sessionId }, data: { assignedSchoolUsers: { set: all.map(id => ({ id })) } } });
}
