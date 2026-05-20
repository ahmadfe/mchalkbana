export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUserFromRequest } from '@/lib/auth';
import { sendBookingConfirmationEmail, sendInternalBookingNotification } from '@/lib/email';

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
    include: {
      course: true,
      school: true,
      assignedSchoolUsers: { select: { id: true } },
      schoolAllocations: { where: { schoolUserId: authUser.userId }, select: { allocatedSeats: true } },
    },
  });
  if (!session) return NextResponse.json({ error: 'Session hittades inte' }, { status: 404 });

  const isAssigned = session.assignedSchoolUsers.some((u) => u.id === authUser.userId);
  const allocation = (session as any).schoolAllocations?.[0] ?? null;

  // Must be assigned OR have an allocation
  if (!isAssigned && !allocation) {
    return NextResponse.json({ error: 'Detta pass är inte tilldelat din skola' }, { status: 403 });
  }

  // For school-only sessions: check seatsAvailable (shared pool)
  // For public sessions with allocation: allocation quota is the only limit
  if (session.visibility === 'school' && session.seatsAvailable <= 0) {
    return NextResponse.json({ error: 'Inga platser kvar' }, { status: 409 });
  }

  // Enforce per-school allocation quota
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

  const bookingData = {
    sessionId,
    guestName,
    personnummer,
    guestPhone: guestPhone || null,
    guestEmail: guestEmail || null,
    status: 'Confirmed',
    bookedByRole: 'school',
    bookedBySchoolUserId: authUser.userId,
  };

  // Only decrement seatsAvailable for school-only sessions (public sessions track public seats separately)
  const booking = session.visibility === 'school'
    ? (await prisma.$transaction([
        prisma.booking.create({ data: bookingData }),
        prisma.session.update({ where: { id: sessionId }, data: { seatsAvailable: { decrement: 1 } } }),
      ]))[0]
    : await prisma.booking.create({ data: bookingData });

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

  // Send internal staff notification
  const courseDate = new Date(session.startTime).toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Stockholm' });
  const courseTime = `${new Date(session.startTime).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Stockholm' })} – ${new Date(session.endTime).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Stockholm' })}`;
  sendInternalBookingNotification({
    bookingId: booking.id,
    studentName: guestName,
    personnummer,
    phone: guestPhone || null,
    email: guestEmail || null,
    courseName: `${session.course.titleSv} (${session.course.behorighet})`,
    courseDate,
    courseTime,
    location: session.course.location || session.school.name,
    bookedBy: 'school',
    status: 'Confirmed',
  }).catch((err) => console.error('[School booking] Internal notification failed:', err));

  return NextResponse.json({ booking }, { status: 201 });
}
