import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUserFromRequest } from '@/lib/auth';
import { sendBookingConfirmationEmail } from '@/lib/email';

// GET: all bookings for sessions assigned to this school
export async function GET(request: Request) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser || authUser.role !== 'school') {
    return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  }

  const bookings = await prisma.booking.findMany({
    where: {
      status: { not: 'Canceled' },
      session: { assignedSchoolUserId: authUser.userId },
    },
    include: {
      session: { include: { course: true, school: true } },
    },
    orderBy: { bookingTime: 'desc' },
  });

  return NextResponse.json({ bookings });
}

// POST: school adds a student to a session
export async function POST(request: Request) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser || authUser.role !== 'school') {
    return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  }

  const { sessionId, guestName, personnummer, guestPhone, guestEmail } = await request.json();
  if (!sessionId || !guestName || !personnummer) {
    return NextResponse.json({ error: 'Session, namn och personnummer krävs' }, { status: 400 });
  }

  const session = await prisma.session.findUnique({ where: { id: sessionId }, include: { course: true, school: true } });
  if (!session) return NextResponse.json({ error: 'Session hittades inte' }, { status: 404 });
  if (session.assignedSchoolUserId !== authUser.userId) {
    return NextResponse.json({ error: 'Detta pass är inte tilldelat din skola' }, { status: 403 });
  }
  if (session.seatsAvailable <= 0) {
    return NextResponse.json({ error: 'Inga platser kvar' }, { status: 409 });
  }

  // Duplicate check
  const existing = await prisma.booking.findFirst({
    where: { sessionId, personnummer, status: { not: 'Canceled' } },
  });
  if (existing) return NextResponse.json({ error: 'Detta personnummer är redan bokat på detta pass' }, { status: 409 });

  const [booking] = await prisma.$transaction([
    prisma.booking.create({
      data: {
        sessionId,
        guestName,
        personnummer,
        guestPhone: guestPhone || null,
        guestEmail: guestEmail || null,
        status: 'Confirmed',
        bookedByRole: 'school',
      },
    }),
    prisma.session.update({
      where: { id: sessionId },
      data: { seatsAvailable: { decrement: 1 } },
    }),
  ]);

  if (guestEmail) {
    const courseDate = new Date(session.startTime).toLocaleDateString('sv-SE');
    const courseTime = `${new Date(session.startTime).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })} – ${new Date(session.endTime).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}`;
    await sendBookingConfirmationEmail({
      recipientEmail: guestEmail,
      recipientName: guestName,
      bookingId: booking.id,
      courseName: session.course.titleSv,
      courseDate,
      courseTime,
      location: session.course.location || session.school.name,
      schoolName: session.school.name,
      personnummer,
      phone: guestPhone || null,
    });
  }

  return NextResponse.json({ booking }, { status: 201 });
}
