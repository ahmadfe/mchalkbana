import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUserFromRequest } from '@/lib/auth';
import { sendBookingConfirmationEmail } from '@/lib/email';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser || authUser.role !== 'admin') {
    return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  }

  const bookingId = parseInt(params.id);
  const { newSessionId } = await request.json();

  if (!newSessionId) {
    return NextResponse.json({ error: 'newSessionId krävs' }, { status: 400 });
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { session: { include: { course: true, school: true } }, user: { select: { name: true, email: true } } },
  });
  if (!booking) return NextResponse.json({ error: 'Bokning hittades inte' }, { status: 404 });

  if (booking.sessionId === newSessionId) {
    return NextResponse.json({ error: 'Eleven är redan i det här passet' }, { status: 400 });
  }

  const newSession = await prisma.session.findUnique({
    where: { id: newSessionId },
    include: { course: true, school: true },
  });
  if (!newSession) return NextResponse.json({ error: 'Nytt pass hittades inte' }, { status: 404 });
  if (newSession.seatsAvailable <= 0) {
    return NextResponse.json({ error: 'Inga platser kvar i det valda passet' }, { status: 400 });
  }

  const oldSessionId = booking.sessionId;
  const wasCanceled = booking.status === 'Canceled';

  await prisma.$transaction(async (tx) => {
    await tx.booking.update({
      where: { id: bookingId },
      data: { sessionId: newSessionId },
    });
    // Restore seat in old session (only if booking wasn't already canceled)
    if (!wasCanceled) {
      await tx.session.update({
        where: { id: oldSessionId },
        data: { seatsAvailable: { increment: 1 } },
      });
    }
    // Consume seat in new session
    await tx.session.update({
      where: { id: newSessionId },
      data: { seatsAvailable: { decrement: 1 } },
    });
  });

  // Send confirmation email with new session details
  const recipientEmail = booking.guestEmail || booking.user?.email || null;
  const recipientName = booking.guestName || booking.user?.name || 'Kund';
  if (recipientEmail) {
    const start = new Date(newSession.startTime);
    const end = new Date(newSession.endTime);
    const courseDate = start.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Stockholm' });
    const courseTime = `${start.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Stockholm' })} – ${end.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Stockholm' })}`;
    const location = newSession.course.location || newSession.school?.name || '';
    await sendBookingConfirmationEmail({
      recipientEmail,
      recipientName,
      bookingId,
      courseName: `${newSession.course.titleSv} (${newSession.course.behorighet})`,
      courseDate,
      courseTime,
      location,
      personnummer: booking.personnummer ?? '',
      phone: booking.guestPhone ?? null,
      customMessage: newSession.receiptMessage || newSession.course.receiptMessage || '',
    }).catch((err) => console.error('[move booking] Email failed:', err));
  }

  return NextResponse.json({ success: true });
}
