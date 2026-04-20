import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUserFromRequest } from '@/lib/auth';
import { sendReminderEmail } from '@/lib/email';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser || authUser.role !== 'admin') {
    return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  }

  const sessionId = parseInt(params.id);

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      course: true,
      school: true,
      bookings: {
        where: {
          status: { in: ['Paid', 'Confirmed'] },
          OR: [{ guestEmail: { not: null } }, { user: { email: { not: undefined } } }],
        },
        include: { user: { select: { name: true, email: true } } },
      },
    },
  });

  if (!session) return NextResponse.json({ error: 'Pass hittades inte' }, { status: 404 });

  const start = new Date(session.startTime);
  const end = new Date(session.endTime);
  const courseDate = start.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Stockholm' });
  const courseTime = `${start.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Stockholm' })} – ${end.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Stockholm' })}`;
  const location = session.course.location || session.school.name;
  const customMessage = session.receiptMessage || session.course.receiptMessage || '';

  const sent: number[] = [];
  const failed: number[] = [];

  for (const booking of session.bookings) {
    const recipientEmail = booking.guestEmail ?? booking.user?.email ?? null;
    if (!recipientEmail) continue;

    try {
      await sendReminderEmail({
        recipientEmail,
        recipientName: booking.guestName ?? booking.user?.name ?? 'Kund',
        bookingId: booking.id,
        courseName: `${session.course.titleSv} (${session.course.behorighet})`,
        courseDate,
        courseTime,
        location,
        customMessage,
      });
      sent.push(booking.id);
    } catch {
      failed.push(booking.id);
    }
  }

  return NextResponse.json({ sent, failed });
}
