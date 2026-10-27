// Platser som reserveras åt trafikskolor på ett kurstillfälle (SessionSchoolAllocation).
import { prisma } from './db';
import { recalcSeats, courseEmailInfo } from './kurser';
import { sendSchoolReservationEmail } from './email';

/** Antal elever en skola har bokat på ett pass. */
export function schoolBookedCount(sessionId: number, schoolUserId: number) {
  return prisma.booking.count({ where: { sessionId, bookedBySchoolUserId: schoolUserId, status: { not: 'Canceled' } } });
}

/**
 * Efter "fyll senast" krymper skolans reservation till det den faktiskt har bokat.
 * Resten blir publika platser igen. Körs när pass läses, så inget schemalagt jobb behövs.
 */
export async function releaseExpiredAllocations(sessionId?: number): Promise<void> {
  const expired = await prisma.sessionSchoolAllocation.findMany({
    where: { releasedAt: null, fillBy: { lt: new Date() }, ...(sessionId ? { sessionId } : {}) },
    select: { id: true, sessionId: true, schoolUserId: true },
  });
  if (expired.length === 0) return;
  const touched = new Set<number>();
  for (const a of expired) {
    const used = await schoolBookedCount(a.sessionId, a.schoolUserId);
    await prisma.sessionSchoolAllocation.update({ where: { id: a.id }, data: { allocatedSeats: used, releasedAt: new Date() } });
    touched.add(a.sessionId);
  }
  for (const id of Array.from(touched)) await recalcSeats(id);
}

export interface ReservationInput {
  schoolUserId: number;
  seats: number;
  fillBy: string | null; // ÅÅÅÅ-MM-DD
  meetingPlace: string;
  message: string;
}

export function parseReservation(body: Record<string, unknown>): { error: string } | { data: ReservationInput } {
  const schoolUserId = Number(body.schoolUserId);
  const seats = Number(body.seats);
  if (!schoolUserId) return { error: 'Välj trafikskola' };
  if (!Number.isInteger(seats) || seats < 1) return { error: 'Antal platser måste vara minst 1' };
  const fillBy = body.fillBy ? String(body.fillBy) : null;
  if (fillBy && !/^\d{4}-\d{2}-\d{2}$/.test(fillBy)) return { error: 'Ogiltigt datum för "fyll senast"' };
  return {
    data: {
      schoolUserId,
      seats,
      fillBy,
      meetingPlace: String(body.meetingPlace ?? '').trim().slice(0, 200),
      message: String(body.message ?? '').trim().slice(0, 1000),
    },
  };
}

/** "Fyll senast" gäller hela dagen i svensk tid. */
const endOfDay = (ymd: string) => new Date(`${ymd}T23:59:59+01:00`);

/**
 * Skapar eller ändrar en skolas reservation. Kontrollerar att platserna räcker och
 * mejlar skolan när den får nya eller fler platser.
 */
export async function saveReservation(sessionId: number, input: ReservationInput, { notify }: { notify: boolean }): Promise<{ error: string } | { ok: true }> {
  const [session, school, existing, used] = await Promise.all([
    prisma.session.findUnique({
      where: { id: sessionId },
      include: { course: true, school: true, schoolAllocations: true },
    }),
    prisma.user.findUnique({ where: { id: input.schoolUserId }, select: { id: true, role: true, name: true, email: true } }),
    prisma.sessionSchoolAllocation.findUnique({ where: { sessionId_schoolUserId: { sessionId, schoolUserId: input.schoolUserId } } }),
    schoolBookedCount(sessionId, input.schoolUserId),
  ]);
  if (!session) return { error: 'Kursen hittades inte' };
  if (!school || school.role !== 'school') return { error: 'Trafikskolan hittades inte' };
  if (input.seats < used) return { error: `${school.name} har redan ${used} elever bokade – minst ${used} platser` };

  const otherReserved = session.schoolAllocations.filter(a => a.schoolUserId !== input.schoolUserId).reduce((s, a) => s + a.allocatedSeats, 0);
  const publicBooked = await prisma.booking.count({ where: { sessionId, status: { not: 'Canceled' }, bookedBySchoolUserId: null } });
  const free = session.seatLimit - otherReserved - publicBooked;
  if (input.seats > free) {
    return { error: `Det finns bara ${Math.max(0, free)} platser att reservera (${session.seatLimit} totalt, ${otherReserved} reserverade för andra skolor, ${publicBooked} bokade av elever)` };
  }

  const data = {
    allocatedSeats: input.seats,
    meetingPlace: input.meetingPlace,
    message: input.message,
    fillBy: input.fillBy ? endOfDay(input.fillBy) : null,
    // Ett nytt datum i framtiden öppnar reservationen igen
    ...(input.fillBy && endOfDay(input.fillBy) > new Date() ? { releasedAt: null } : {}),
  };
  await prisma.sessionSchoolAllocation.upsert({
    where: { sessionId_schoolUserId: { sessionId, schoolUserId: input.schoolUserId } },
    update: data,
    create: { sessionId, schoolUserId: input.schoolUserId, ...data },
  });
  await recalcSeats(sessionId);

  const gotMore = !existing || input.seats > existing.allocatedSeats;
  if (notify && gotMore && school.email) {
    const info = courseEmailInfo(session);
    await sendSchoolReservationEmail({
      email: school.email,
      schoolName: school.name,
      ...info,
      location: input.meetingPlace || info.location,
      seats: input.seats,
      fillBy: input.fillBy,
      message: input.message,
    }).catch(err => console.error('[Reservation] Mejl till skolan misslyckades:', err));
    await prisma.sessionSchoolAllocation.update({
      where: { sessionId_schoolUserId: { sessionId, schoolUserId: input.schoolUserId } },
      data: { notifiedAt: new Date() },
    });
  }
  return { ok: true };
}

export async function removeReservation(sessionId: number, schoolUserId: number): Promise<{ error: string } | { ok: true }> {
  const used = await schoolBookedCount(sessionId, schoolUserId);
  if (used > 0) return { error: `Skolan har ${used} elever bokade på kursen – avboka dem först eller minska till ${used} platser` };
  await prisma.sessionSchoolAllocation.deleteMany({ where: { sessionId, schoolUserId } });
  await recalcSeats(sessionId);
  return { ok: true };
}

/** Mötesplatsen en elev ska få: skolans egen om eleven bokats av en skola som har en, annars kursens. */
export async function meetingPlaceFor(booking: { sessionId: number; bookedBySchoolUserId: number | null }, fallback: string): Promise<string> {
  if (!booking.bookedBySchoolUserId) return fallback;
  const a = await prisma.sessionSchoolAllocation.findUnique({
    where: { sessionId_schoolUserId: { sessionId: booking.sessionId, schoolUserId: booking.bookedBySchoolUserId } },
    select: { meetingPlace: true },
  });
  return a?.meetingPlace || fallback;
}
