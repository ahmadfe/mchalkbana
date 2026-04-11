import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { validateWhatsappApiKey } from '@/lib/whatsapp-auth';

// POST — called by n8n cron every hour
// Finds bookings starting in 23–25h, not yet reminded, with a phone number
// Sends WhatsApp reminder via WAHA and marks reminderSentAt
export async function POST(request: Request) {
  if (!validateWhatsappApiKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const windowStart = new Date(now.getTime() + 23 * 60 * 60 * 1000); // 23h from now
  const windowEnd = new Date(now.getTime() + 25 * 60 * 60 * 1000);   // 25h from now

  const bookings = await prisma.booking.findMany({
    where: {
      status: { in: ['Paid', 'Confirmed'] },
      reminderSentAt: null,
      guestPhone: { not: null },
      session: {
        startTime: {
          gte: windowStart,
          lte: windowEnd,
        },
      },
    },
    include: {
      session: { include: { course: true, school: true } },
    },
  });

  if (bookings.length === 0) {
    return NextResponse.json({ sent: [] });
  }

  const wahaUrl = process.env.WAHA_URL;
  const wahaSession = process.env.WAHA_SESSION ?? 'default';
  const wahaApiKey = process.env.WAHA_API_KEY ?? '';

  const sent: { bookingId: number; phone: string }[] = [];

  for (const booking of bookings) {
    const phone = booking.guestPhone!;
    const start = new Date(booking.session.startTime);
    const dateStrSv = start.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' });
    const timeStr = start.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
    const location = booking.session.course.location || booking.session.school.name;

    const msg =
      `⏰ *Påminnelse – imorgon!*\n` +
      `Du har en bokad kurs hos Uppsala Halkbana.\n\n` +
      `📚 ${booking.session.course.titleSv}\n` +
      `📅 ${dateStrSv}\n` +
      `🕐 ${timeStr}\n` +
      `📍 ${location}\n` +
      `🎫 Bokning *#${booking.id}*\n\n` +
      `_Kom ihåg att vara i god tid. Vid frågor: 07 07 66 66 61_\n\n` +
      `---\n` +
      `⏰ *Reminder – tomorrow!*\n` +
      `You have a course booked at Uppsala Halkbana.\n\n` +
      `📚 ${booking.session.course.titleEn}\n` +
      `📅 ${dateStrSv}\n` +
      `🕐 ${timeStr}\n` +
      `📍 ${location}\n` +
      `🎫 Booking *#${booking.id}*\n\n` +
      `_Please arrive on time. Questions? Call 07 07 66 66 61_`;

    if (wahaUrl) {
      try {
        await fetch(`${wahaUrl}/api/sendText`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Api-Key': wahaApiKey },
          body: JSON.stringify({
            session: wahaSession,
            chatId: `${phone.replace(/\D/g, '')}@c.us`,
            text: msg,
          }),
        });
      } catch (err) {
        console.error(`[Reminder] WAHA send failed for booking #${booking.id}:`, err);
        continue;
      }
    }

    // Mark reminder as sent
    await prisma.booking.update({
      where: { id: booking.id },
      data: { reminderSentAt: now },
    });

    sent.push({ bookingId: booking.id, phone });
    console.log(`[Reminder] Sent to booking #${booking.id} — ${phone}`);
  }

  return NextResponse.json({ sent });
}
