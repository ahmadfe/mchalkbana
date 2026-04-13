import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUserFromRequest } from '@/lib/auth';
import { sendCancellationEmail } from '@/lib/email';

// DELETE: school removes a student from a session
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser || authUser.role !== 'school') {
    return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  }

  const bookingId = parseInt(params.id);
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { session: { include: { course: true, school: true } }, user: { select: { name: true, email: true } } },
  });

  if (!booking) return NextResponse.json({ error: 'Bokning hittades inte' }, { status: 404 });
  if (booking.bookedBySchoolUserId !== authUser.userId) {
    return NextResponse.json({ error: 'Ej behörig att ta bort denna bokning' }, { status: 403 });
  }

  const sessionId = booking.sessionId;
  await prisma.booking.delete({ where: { id: bookingId } });
  await prisma.session.update({
    where: { id: sessionId },
    data: { seatsAvailable: { increment: 1 } },
  });

  // Send cancellation email if we have a contact address
  const recipientEmail = booking.guestEmail || booking.user?.email || null;
  const recipientName = booking.guestName || booking.user?.name || 'Kund';
  if (recipientEmail && booking.session) {
    const start = new Date(booking.session.startTime);
    const end = new Date(booking.session.endTime);
    sendCancellationEmail({
      recipientEmail,
      recipientName,
      bookingId,
      courseName: `${booking.session.course.titleSv} (${booking.session.course.behorighet})`,
      courseDate: start.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Stockholm' }),
      courseTime: `${start.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Stockholm' })} – ${end.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Stockholm' })}`,
      location: booking.session.course.location || booking.session.school?.name || '',
      cancelledBy: 'school',
    }).catch((err) => console.error('[School cancel] Email failed:', err));
  }

  return NextResponse.json({ success: true });
}
