export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyBookingToken } from '@/lib/booking-token';

const LOCK_HOURS = 74;

export async function GET(_request: Request, { params }: { params: { token: string } }) {
  const payload = await verifyBookingToken(params.token);
  if (!payload) {
    return NextResponse.json({ error: 'Ogiltig eller utgången länk' }, { status: 401 });
  }

  const booking = await prisma.booking.findUnique({
    where: { id: payload.bookingId },
    include: { session: { include: { course: true, school: true } } },
  });

  if (!booking) return NextResponse.json({ error: 'Bokning hittades inte' }, { status: 404 });
  if (booking.status === 'Canceled') return NextResponse.json({ error: 'Bokningen är avbokad' }, { status: 400 });

  const hoursUntilSession = (new Date(booking.session.startTime).getTime() - Date.now()) / (1000 * 60 * 60);
  const locked = hoursUntilSession < LOCK_HOURS;

  const cutoff = new Date(Date.now() + 60 * 60 * 1000);
  const alternatives = locked ? [] : await prisma.session.findMany({
    where: {
      courseId: booking.session.courseId,
      id: { not: booking.sessionId },
      seatsAvailable: { gt: 0 },
      startTime: { gt: cutoff },
      visibility: 'public',
    },
    include: { course: true, school: true },
    orderBy: { startTime: 'asc' },
  });

  return NextResponse.json({
    booking: {
      id: booking.id,
      status: booking.status,
      guestName: booking.guestName,
      personnummer: booking.personnummer,
      session: booking.session,
    },
    alternatives,
    locked,
    hoursUntilSession: Math.floor(hoursUntilSession),
    lockHours: LOCK_HOURS,
  });
}
