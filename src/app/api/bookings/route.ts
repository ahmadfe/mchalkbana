import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
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
  if (!authUser) return NextResponse.json({ error: 'Ej inloggad' }, { status: 401 });

  const { sessionId } = await request.json();
  if (!sessionId) return NextResponse.json({ error: 'sessionId krävs' }, { status: 400 });

  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session) return NextResponse.json({ error: 'Session hittades inte' }, { status: 404 });
  if (session.seatsAvailable <= 0) return NextResponse.json({ error: 'Inga platser kvar' }, { status: 409 });

  // Check if user already booked this session
  const existing = await prisma.booking.findFirst({
    where: { sessionId, userId: authUser.userId, status: { not: 'Canceled' } },
  });
  if (existing) return NextResponse.json({ error: 'Du har redan bokat detta pass' }, { status: 409 });

  const [booking] = await prisma.$transaction([
    prisma.booking.create({
      data: { sessionId, userId: authUser.userId, status: 'Pending' },
      include: { session: { include: { course: true, school: true } } },
    }),
    prisma.session.update({
      where: { id: sessionId },
      data: { seatsAvailable: { decrement: 1 } },
    }),
  ]);

  return NextResponse.json({ booking }, { status: 201 });
}
