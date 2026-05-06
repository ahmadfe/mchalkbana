export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyBookingToken, signBookingToken } from '@/lib/booking-token';
import { sendBookingConfirmationEmail } from '@/lib/email';

const LOCK_HOURS = 74;

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { token, newSessionId } = body;

  if (!token || !newSessionId) {
    return NextResponse.json({ error: 'Token och nytt pass krävs' }, { status: 400 });
  }

  const payload = await verifyBookingToken(token);
  if (!payload) {
    return NextResponse.json({ error: 'Ogiltig eller utgången länk' }, { status: 401 });
  }

  const booking = await prisma.booking.findUnique({
    where: { id: payload.bookingId },
    include: { session: { include: { course: true, school: true } } },
  });

  if (!booking) return NextResponse.json({ error: 'Bokning hittades inte' }, { status: 404 });
  if (booking.status === 'Canceled') return NextResponse.json({ error: 'Bokningen är avbokad' }, { status: 400 });

  const hoursUntilSession = (new Date(booking.session.startTime).getTime() - Date.now()) / (1000 * 60 * 60);
  if (hoursUntilSession < LOCK_HOURS) {
    return NextResponse.json({ error: `Tidsbyte är låst ${LOCK_HOURS} timmar innan kursen` }, { status: 400 });
  }

  if (booking.sessionId === newSessionId) {
    return NextResponse.json({ error: 'Du är redan bokad på detta pass' }, { status: 400 });
  }

  const newSession = await prisma.session.findUnique({
    where: { id: newSessionId },
    include: { course: true, school: true },
  });
  if (!newSession) return NextResponse.json({ error: 'Nytt pass hittades inte' }, { status: 404 });
  if (newSession.courseId !== booking.session.courseId) {
    return NextResponse.json({ error: 'Ogiltigt pass' }, { status: 400 });
  }
  if (newSession.seatsAvailable <= 0) {
    return NextResponse.json({ error: 'Inga platser kvar i det valda passet' }, { status: 400 });
  }

  const oldSessionId = booking.sessionId;
  await prisma.$transaction(async (tx) => {
    await tx.booking.update({ where: { id: booking.id }, data: { sessionId: newSessionId } });
    await tx.session.update({ where: { id: oldSessionId }, data: { seatsAvailable: { increment: 1 } } });
    await tx.session.update({ where: { id: newSessionId }, data: { seatsAvailable: { decrement: 1 } } });
  });

  const recipientEmail = booking.guestEmail || null;
  if (recipientEmail) {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://uppsalahalkbana.se';
    const newToken = await signBookingToken(booking.id);
    const changeUrl = `${baseUrl}/sv/byt-tid?token=${newToken}`;
    const start = new Date(newSession.startTime);
    const end = new Date(newSession.endTime);
    await sendBookingConfirmationEmail({
      recipientEmail,
      recipientName: booking.guestName || 'Kund',
      bookingId: booking.id,
      courseName: `${newSession.course.titleSv} (${newSession.course.behorighet})`,
      courseDate: start.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Stockholm' }),
      courseTime: `${start.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Stockholm' })} – ${end.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Stockholm' })}`,
      location: newSession.course.location || newSession.school?.name || '',
      personnummer: booking.personnummer,
      phone: booking.guestPhone,
      customMessage: newSession.receiptMessage || newSession.course.receiptMessage || '',
      changeUrl,
    }).catch((err) => console.error('[public change] Email failed:', err));
  }

  return NextResponse.json({ success: true });
}
