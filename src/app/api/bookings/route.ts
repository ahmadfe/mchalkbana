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

  const body = await request.json();
  const { sessionId, guestName, personnummer, guestPhone, guestEmail } = body;

  if (!sessionId) return NextResponse.json({ error: 'sessionId krävs' }, { status: 400 });

  // Guest bookings require name, personnummer and email
  if (!authUser) {
    if (!guestName || !personnummer || !guestEmail) {
      return NextResponse.json({ error: 'Namn, personnummer och e-post krävs' }, { status: 400 });
    }
  }

  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session) return NextResponse.json({ error: 'Session hittades inte' }, { status: 404 });
  if (session.seatsAvailable <= 0) return NextResponse.json({ error: 'Inga platser kvar' }, { status: 409 });

  // Check duplicate for logged-in users
  if (authUser) {
    const existing = await prisma.booking.findFirst({
      where: { sessionId, userId: authUser.userId, status: { not: 'Canceled' } },
    });
    if (existing) return NextResponse.json({ error: 'Du har redan bokat detta pass' }, { status: 409 });
  }

  // Check duplicate for guests (same personnummer + session)
  if (!authUser && personnummer) {
    const existingGuest = await prisma.booking.findFirst({
      where: { sessionId, personnummer, status: { not: 'Canceled' } },
    });
    if (existingGuest) return NextResponse.json({ error: 'Detta personnummer har redan bokat detta pass' }, { status: 409 });
  }

  const bookingData = authUser
    ? { sessionId, userId: authUser.userId, status: 'Pending' as const }
    : { sessionId, guestName, personnummer, guestPhone: guestPhone || null, guestEmail, status: 'Pending' as const };

  const [booking] = await prisma.$transaction([
    prisma.booking.create({
      data: bookingData,
      include: { session: { include: { course: true, school: true } } },
    }),
    prisma.session.update({
      where: { id: sessionId },
      data: { seatsAvailable: { decrement: 1 } },
    }),
  ]);

  return NextResponse.json({ booking }, { status: 201 });
}
