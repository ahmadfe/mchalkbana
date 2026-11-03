export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createPendingBooking } from '@/lib/publicBooking';
import { getAuthUserFromRequest } from '@/lib/auth';

export async function GET(request: Request) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser) return NextResponse.json({ error: 'Ej inloggad' }, { status: 401 });

  const bookings = await prisma.booking.findMany({
    where: { userId: authUser.userId },
    include: {
      session: { include: { course: true, school: true } },
      payment: true,
    },
    orderBy: { bookingTime: 'desc' },
  });

  return NextResponse.json({ bookings });
}

export async function POST(request: Request) {
  const authUser = await getAuthUserFromRequest(request);
  const { sessionId, guestName, personnummer, guestPhone, guestEmail } = await request.json();
  const result = await createPendingBooking(Number(sessionId), authUser?.userId ?? null, { guestName, personnummer, guestPhone, guestEmail });
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ booking: result.booking }, { status: 201 });
}
