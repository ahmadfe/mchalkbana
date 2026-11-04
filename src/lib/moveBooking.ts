import { prisma } from './db';
import { meetingPlaceFor } from './allocations';
import { recalcSeats, stockholmDay } from './kurser';

/**
 * Flytta en elev till ett annat kurstillfälle av samma kurs (samma pris).
 * Betalning, skola, rabattkod, anteckning, kombodelar och skolans saldo följer med bokningen.
 * Fullt tillfälle går att välja (admin får överboka) – det visas som varning.
 */

type Result = { ok: true; overbooked: boolean } | { ok: false; status: number; error: string };

export interface MoveOption {
  id: number;
  startTime: string;
  endTime: string;
  booked: number;
  seatLimit: number;
  sameDay: boolean;
}

/** Kommande tillfällen (från och med i dag) av samma kurs. Samma dag först, sedan i tidsordning. */
export async function moveOptions(bookingId: number): Promise<{ current: { startTime: string }; options: MoveOption[] } | null> {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, include: { session: true } });
  if (!booking) return null;
  const today = stockholmDay(new Date()).from;
  const day = stockholmDay(booking.session.startTime);
  const sessions = await prisma.session.findMany({
    where: { courseId: booking.session.courseId, status: { not: 'canceled' }, startTime: { gte: today }, id: { not: booking.sessionId } },
    orderBy: { startTime: 'asc' },
    take: 80,
    select: { id: true, startTime: true, endTime: true, seatLimit: true, _count: { select: { bookings: { where: { status: { not: 'Canceled' } } } } } },
  });
  const options = sessions.map(s => ({
    id: s.id,
    startTime: s.startTime.toISOString(),
    endTime: s.endTime.toISOString(),
    booked: s._count.bookings,
    seatLimit: s.seatLimit,
    sameDay: s.startTime >= day.from && s.startTime < day.to,
  }));
  options.sort((a, b) => Number(b.sameDay) - Number(a.sameDay) || a.startTime.localeCompare(b.startTime));
  return { current: { startTime: booking.session.startTime.toISOString() }, options };
}

export async function moveBooking(bookingId: number, newSessionId: number, notify: boolean): Promise<Result> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { session: true, user: { select: { name: true, email: true } } },
  });
  if (!booking) return { ok: false, status: 404, error: 'Bokningen hittades inte' };
  if (booking.sessionId === newSessionId) return { ok: false, status: 400, error: 'Eleven är redan på det här tillfället' };
  if (booking.status === 'Canceled') return { ok: false, status: 400, error: 'Bokningen är avbokad' };
  if (booking.checkedInAt) return { ok: false, status: 400, error: 'Eleven är incheckad – ångra incheckningen först' };
  if (booking.invoiceId) return { ok: false, status: 400, error: 'Eleven finns redan på en faktura – kreditera fakturan först' };

  const target = await prisma.session.findUnique({
    where: { id: newSessionId },
    include: { course: true, school: true, _count: { select: { bookings: { where: { status: { not: 'Canceled' } } } } } },
  });
  if (!target) return { ok: false, status: 404, error: 'Kurstillfället hittades inte' };
  if (target.status === 'canceled') return { ok: false, status: 400, error: 'Kurstillfället är inställt' };
  if (target.courseId !== booking.session.courseId) return { ok: false, status: 400, error: 'Eleven kan bara flyttas till samma kurs' };
  if (target.startTime < stockholmDay(new Date()).from) return { ok: false, status: 400, error: 'Kurstillfället har redan varit' };

  const overbooked = target._count.bookings >= target.seatLimit;
  await prisma.booking.update({
    where: { id: bookingId },
    data: {
      sessionId: newSessionId,
      // Nytt tillfälle – närvaro, bedömning och påminnelser börjar om
      attendance: 'registered', result: null, resultNote: null,
      reminderSentAt: null, emailReminderSentAt: null,
    },
  });
  await recalcSeats(booking.sessionId);
  await recalcSeats(newSessionId);

  const email = booking.guestEmail || booking.user?.email;
  if (notify && email) {
    const { sendBookingConfirmationEmail } = await import('./email');
    const tz = { timeZone: 'Europe/Stockholm' } as const;
    const hm = (d: Date) => d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', ...tz });
    const location = await meetingPlaceFor(
      { sessionId: target.id, bookedBySchoolUserId: booking.bookedBySchoolUserId },
      target.meetingPlace || target.course.location || target.school?.name || '',
    );
    await sendBookingConfirmationEmail({
      recipientEmail: email,
      recipientName: booking.guestName || booking.user?.name || 'Kund',
      bookingId,
      courseName: `${target.course.titleSv} (${target.course.behorighet})`,
      courseDate: target.startTime.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', ...tz }),
      courseTime: `${hm(target.startTime)} – ${hm(target.endTime)}`,
      location,
      personnummer: booking.personnummer ?? '',
      phone: booking.guestPhone ?? null,
      customMessage: target.receiptMessage || target.course.receiptMessage || '',
    }).catch(err => console.error('[move booking] Email failed:', err));
  }
  return { ok: true, overbooked };
}
