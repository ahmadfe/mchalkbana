export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUserFromRequest } from '@/lib/auth';
import { sendBookingConfirmationEmail } from '@/lib/email';

// GET: all bookings made by this school
export async function GET(request: Request) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser || authUser.role !== 'school') {
    return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  }

  const bookings = await prisma.booking.findMany({
    where: {
      status: { not: 'Canceled' },
      bookedBySchoolUserId: authUser.userId,
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

  const { sessionId, guestName, personnummer, guestPhone, guestEmail, sendConfirmation } = await request.json();
  if (!sessionId || !guestName || !personnummer) {
    return NextResponse.json({ error: 'Session, namn och personnummer krävs' }, { status: 400 });
  }

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { course: true, school: true, assignedSchoolUsers: { select: { id: true } } },
  });
  if (!session) return NextResponse.json({ error: 'Session hittades inte' }, { status: 404 });

  // Verify this school is assigned to the session
  const isAssigned = session.assignedSchoolUsers.some((u) => u.id === authUser.userId);
  if (!isAssigned) {
    return NextResponse.json({ error: 'Detta pass är inte tilldelat din skola' }, { status: 403 });
  }
  if (session.seatsAvailable <= 0) {
    return NextResponse.json({ error: 'Inga platser kvar' }, { status: 409 });
  }

  // Enforce per-school seat allocation if one exists
  const allocation = await prisma.sessionSchoolAllocation.findUnique({
    where: { sessionId_schoolUserId: { sessionId, schoolUserId: authUser.userId } },
  });
  if (allocation) {
    const usedSeats = await prisma.booking.count({
      where: { sessionId, bookedBySchoolUserId: authUser.userId, status: { not: 'Canceled' } },
    });
    if (usedSeats >= allocation.allocatedSeats) {
      return NextResponse.json(
        { error: `Din skola har nått sin platskvot (${usedSeats}/${allocation.allocatedSeats} platser bokade)` },
        { status: 409 },
      );
    }
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
        bookedBySchoolUserId: authUser.userId,
      },
    }),
    prisma.session.update({
      where: { id: sessionId },
      data: { seatsAvailable: { decrement: 1 } },
    }),
  ]);

  if (guestEmail && sendConfirmation) {
    const schoolUser = await prisma.user.findUnique({
      where: { id: authUser.userId },
      select: { name: true },
    });
    const courseDate = new Date(session.startTime).toLocaleDateString('sv-SE');
    const courseTime = `${new Date(session.startTime).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })} – ${new Date(session.endTime).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}`;
    await sendBookingConfirmationEmail({
      recipientEmail: guestEmail,
      recipientName: guestName,
      bookingId: booking.id,
      courseName: `${session.course.titleSv} (${session.course.behorighet})`,
      courseDate,
      courseTime,
      location: session.course.location || session.school.name,
      schoolName: schoolUser?.name || session.school.name,
      personnummer,
      phone: guestPhone || null,
    });
  }

  return NextResponse.json({ booking }, { status: 201 });
}
