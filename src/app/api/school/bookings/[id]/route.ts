import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUserFromRequest } from '@/lib/auth';
import { sendCancellationEmail, sendInternalBookingNotification } from '@/lib/email';

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

  // Send cancellation email + internal notification
  if (booking.session) {
    const recipientEmail = booking.guestEmail || booking.user?.email || null;
    const recipientName = booking.guestName || booking.user?.name || 'Kund';
    const start = new Date(booking.session.startTime);
    const end = new Date(booking.session.endTime);
    const scCourseName = `${booking.session.course.titleSv} (${booking.session.course.behorighet})`;
    const scCourseDate = start.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Stockholm' });
    const scCourseTime = `${start.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Stockholm' })} – ${end.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Stockholm' })}`;
    const scLocation = booking.session.course.location || booking.session.school?.name || '';
    if (recipientEmail) {
      sendCancellationEmail({
        recipientEmail,
        recipientName,
        bookingId,
        courseName: scCourseName,
        courseDate: scCourseDate,
        courseTime: scCourseTime,
        location: scLocation,
        cancelledBy: 'school',
      }).catch((err) => console.error('[School cancel] Email failed:', err));
    }
    sendInternalBookingNotification({
      bookingId,
      studentName: booking.guestName || booking.user?.name || 'Okänd',
      personnummer: booking.personnummer ?? '–',
      phone: booking.guestPhone,
      email: booking.guestEmail || booking.user?.email,
      courseName: scCourseName,
      courseDate: scCourseDate,
      courseTime: scCourseTime,
      location: scLocation,
      bookedBy: 'school',
      status: 'Canceled',
      cancelledBy: 'school',
    }).catch((err) => console.error('[School cancel] Internal cancel notification failed:', err));
  }

  return NextResponse.json({ success: true });
}
