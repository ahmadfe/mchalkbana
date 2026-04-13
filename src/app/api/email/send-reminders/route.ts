import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { validateWhatsappApiKey } from '@/lib/whatsapp-auth';
import { sendReminderEmail } from '@/lib/email';

// POST — called by n8n cron every hour
// Finds paid/confirmed bookings starting in 22–26h with an email, not yet reminded
export async function POST(request: Request) {
  if (!validateWhatsappApiKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const windowStart = new Date(now.getTime() + 22 * 60 * 60 * 1000);
  const windowEnd   = new Date(now.getTime() + 26 * 60 * 60 * 1000);

  const bookings = await prisma.booking.findMany({
    where: {
      status: { in: ['Paid', 'Confirmed'] },
      emailReminderSentAt: null,
      OR: [
        { guestEmail: { not: null } },
        { user: { email: { not: undefined } } },
      ],
      session: {
        startTime: { gte: windowStart, lte: windowEnd },
      },
    },
    include: {
      session: { include: { course: true, school: true } },
      user: { select: { name: true, email: true } },
    },
  });

  if (bookings.length === 0) {
    return NextResponse.json({ sent: [] });
  }

  const sent: { bookingId: number; email: string }[] = [];

  for (const booking of bookings) {
    const recipientEmail = booking.guestEmail || booking.user?.email || null;
    const recipientName  = booking.guestName  || booking.user?.name  || 'Kund';
    if (!recipientEmail) continue;

    const start = new Date(booking.session.startTime);
    const end   = new Date(booking.session.endTime);

    try {
      await sendReminderEmail({
        recipientEmail,
        recipientName,
        bookingId: booking.id,
        courseName: `${booking.session.course.titleSv} (${booking.session.course.behorighet})`,
        courseDate: start.toLocaleDateString('sv-SE', {
          weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Stockholm',
        }),
        courseTime: `${start.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Stockholm' })} – ${end.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Stockholm' })}`,
        location: booking.session.course.location || booking.session.school.name,
        customMessage: booking.session.receiptMessage || booking.session.course.receiptMessage || '',
      });

      await prisma.booking.update({
        where: { id: booking.id },
        data: { emailReminderSentAt: now },
      });

      sent.push({ bookingId: booking.id, email: recipientEmail });
      console.log(`[EmailReminder] Sent to booking #${booking.id} — ${recipientEmail}`);
    } catch (err) {
      console.error(`[EmailReminder] Failed for booking #${booking.id}:`, err);
    }
  }

  return NextResponse.json({ sent });
}
