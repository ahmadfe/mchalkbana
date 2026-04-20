import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUserFromRequest } from '@/lib/auth';
import { sendReminderEmail } from '@/lib/email';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser || authUser.role !== 'admin') {
    return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  }

  const bookingId = parseInt(params.id);

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      session: { include: { course: true, school: true } },
      user: { select: { name: true, email: true } },
    },
  });

  if (!booking) return NextResponse.json({ error: 'Bokning hittades inte' }, { status: 404 });

  const recipientEmail = booking.guestEmail ?? booking.user?.email ?? null;
  if (!recipientEmail) return NextResponse.json({ error: 'Ingen e-postadress på bokningen' }, { status: 400 });

  const recipientName = booking.guestName ?? booking.user?.name ?? 'Kund';
  const start = new Date(booking.session.startTime);
  const end = new Date(booking.session.endTime);

  await sendReminderEmail({
    recipientEmail,
    recipientName,
    bookingId,
    courseName: `${booking.session.course.titleSv} (${booking.session.course.behorighet})`,
    courseDate: start.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Stockholm' }),
    courseTime: `${start.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Stockholm' })} – ${end.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Stockholm' })}`,
    location: booking.session.course.location || booking.session.school?.name || '',
    customMessage: booking.session.receiptMessage || booking.session.course.receiptMessage || '',
  });

  return NextResponse.json({ ok: true });
}
