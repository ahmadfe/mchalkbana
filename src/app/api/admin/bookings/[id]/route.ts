import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUserFromRequest } from '@/lib/auth';
import { sendBookingConfirmationEmail } from '@/lib/email';

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser || authUser.role !== 'admin') {
    return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  }

  const bookingId = parseInt(params.id);
  const { guestName, personnummer, guestPhone, guestEmail, status } = await request.json();

  const updated = await prisma.booking.update({
    where: { id: bookingId },
    data: {
      ...(guestName !== undefined ? { guestName } : {}),
      ...(personnummer !== undefined ? { personnummer } : {}),
      ...(guestPhone !== undefined ? { guestPhone: guestPhone || null } : {}),
      ...(guestEmail !== undefined ? { guestEmail } : {}),
      ...(status !== undefined ? { status } : {}),
    },
    include: { session: { include: { course: true, school: true } }, user: { select: { name: true, email: true } } },
  });

  return NextResponse.json({ booking: updated });
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser || authUser.role !== 'admin') {
    return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  }

  const bookingId = parseInt(params.id);

  // Get booking to restore seat
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { sessionId: true, status: true },
  });
  if (!booking) return NextResponse.json({ error: 'Bokning hittades inte' }, { status: 404 });

  // Delete payment if exists, then booking
  await prisma.payment.deleteMany({ where: { bookingId } });
  await prisma.booking.delete({ where: { id: bookingId } });

  // Restore seat
  if (booking.status !== 'Canceled') {
    await prisma.session.update({
      where: { id: booking.sessionId },
      data: { seatsAvailable: { increment: 1 } },
    });
  }

  return NextResponse.json({ success: true });
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  // Add a student manually to a session (sessionId = params.id here used as sessionId)
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser || authUser.role !== 'admin') {
    return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  }

  const sessionId = parseInt(params.id);
  const { guestName, personnummer, guestPhone, guestEmail } = await request.json();

  if (!guestName || !personnummer) {
    return NextResponse.json({ error: 'Namn och personnummer krävs' }, { status: 400 });
  }

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { course: true, school: true },
  });
  if (!session) return NextResponse.json({ error: 'Pass hittades inte' }, { status: 404 });
  if (session.seatsAvailable <= 0) return NextResponse.json({ error: 'Inga platser kvar' }, { status: 400 });

  const booking = await prisma.$transaction(async (tx) => {
    const b = await tx.booking.create({
      data: {
        sessionId,
        guestName,
        personnummer,
        guestPhone: guestPhone || null,
        guestEmail: guestEmail || null,
        status: 'Confirmed',
        bookedByRole: 'admin',
      },
    });
    await tx.session.update({
      where: { id: sessionId },
      data: { seatsAvailable: { decrement: 1 } },
    });
    return b;
  });

  // Send confirmation email if email provided
  if (guestEmail) {
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
      personnummer,
      phone: guestPhone || null,
      customMessage: session.course.receiptMessage || '',
    });
  }

  return NextResponse.json({ booking }, { status: 201 });
}
