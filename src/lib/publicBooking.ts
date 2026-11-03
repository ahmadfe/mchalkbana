import type { Booking } from '@prisma/client';
import { prisma } from '@/lib/db';
import { linkBookingToStudent } from '@/lib/students';

export interface GuestInput { guestName: string; personnummer: string; guestPhone?: string | null; guestEmail: string }

/**
 * Skapar en väntande bokning från kassan (gäst eller inloggad) och tar en plats.
 * Används av /api/bookings (Swish) och Klarna-ordern.
 */
export async function createPendingBooking(
  sessionId: number,
  userId: number | null,
  guest: Partial<GuestInput>,
): Promise<{ booking: Booking } | { error: string; status: number }> {
  if (!sessionId) return { error: 'sessionId krävs', status: 400 };
  if (!userId && (!guest.guestName || !guest.personnummer || !guest.guestEmail)) {
    return { error: 'Namn, personnummer och e-post krävs', status: 400 };
  }

  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session) return { error: 'Session hittades inte', status: 404 };
  if (session.status === 'canceled') return { error: 'Kursen är inställd', status: 400 };
  if (session.seatsAvailable <= 0) return { error: 'Inga platser kvar', status: 409 };

  if (userId) {
    const existing = await prisma.booking.findFirst({ where: { sessionId, userId, status: { not: 'Canceled' } } });
    if (existing) return { error: 'Du har redan bokat detta pass', status: 409 };
  } else {
    const existingGuest = await prisma.booking.findFirst({ where: { sessionId, personnummer: guest.personnummer, status: { not: 'Canceled' } } });
    if (existingGuest) return { error: 'Detta personnummer har redan bokat detta pass', status: 409 };
  }

  const data = userId
    ? { sessionId, userId, status: 'Pending' }
    : { sessionId, guestName: guest.guestName, personnummer: guest.personnummer, guestPhone: guest.guestPhone || null, guestEmail: guest.guestEmail, status: 'Pending' };

  const [booking] = await prisma.$transaction([
    prisma.booking.create({ data }),
    prisma.session.update({ where: { id: sessionId }, data: { seatsAvailable: { decrement: 1 } } }),
  ]);
  await linkBookingToStudent(booking.id);
  return { booking };
}

/** Avbryter en väntande bokning och lämnar tillbaka platsen */
export async function cancelPendingBooking(bookingId: number) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, select: { status: true, sessionId: true } });
  if (!booking || booking.status !== 'Pending') return;
  await prisma.$transaction([
    prisma.booking.update({ where: { id: bookingId }, data: { status: 'Canceled' } }),
    prisma.session.update({ where: { id: booking.sessionId }, data: { seatsAvailable: { increment: 1 } } }),
  ]);
}
