export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUserFromRequest } from '@/lib/auth';
import { sendInternalBookingNotification } from '@/lib/email';

// Cancel a booking
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser) return NextResponse.json({ error: 'Ej inloggad' }, { status: 401 });

  const bookingId = parseInt(params.id);
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { session: { include: { course: true, school: true } } },
  });

  if (!booking) return NextResponse.json({ error: 'Bokning hittades inte' }, { status: 404 });
  if (booking.userId !== authUser.userId && authUser.role !== 'admin') {
    return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  }
  if (booking.status === 'Canceled') {
    return NextResponse.json({ error: 'Bokning redan avbokad' }, { status: 400 });
  }

  const [updated] = await prisma.$transaction([
    prisma.booking.update({ where: { id: bookingId }, data: { status: 'Canceled' } }),
    prisma.session.update({ where: { id: booking.sessionId }, data: { seatsAvailable: { increment: 1 } } }),
  ]);

  // Internal staff notification
  if (booking.session) {
    const start = new Date(booking.session.startTime);
    const end = new Date(booking.session.endTime);
    sendInternalBookingNotification({
      bookingId,
      studentName: booking.guestName ?? 'Okänd',
      personnummer: booking.personnummer ?? '–',
      phone: booking.guestPhone,
      email: booking.guestEmail,
      courseName: `${booking.session.course.titleSv} (${booking.session.course.behorighet})`,
      courseDate: start.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Stockholm' }),
      courseTime: `${start.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Stockholm' })} – ${end.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Stockholm' })}`,
      location: booking.session.course.location || booking.session.school?.name || '',
      bookedBy: 'user',
      status: 'Canceled',
      cancelledBy: 'user',
    }).catch((err) => console.error('[User cancel] Internal cancel notification failed:', err));
  }

  return NextResponse.json({ booking: updated });
}
