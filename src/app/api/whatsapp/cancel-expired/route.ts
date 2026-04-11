import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { validateWhatsappApiKey } from '@/lib/whatsapp-auth';

// POST — called by n8n cron every 5 minutes
// Cancels Pending whatsapp bookings older than 15 minutes and restores seats
export async function POST(request: Request) {
  if (!validateWhatsappApiKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - 15 * 60 * 1000);

  const expired = await prisma.booking.findMany({
    where: {
      status: 'Pending',
      bookedByRole: 'whatsapp',
      bookingTime: { lt: cutoff },
    },
    select: { id: true, sessionId: true, guestPhone: true, guestName: true },
  });

  if (expired.length === 0) {
    return NextResponse.json({ canceled: [] });
  }

  // Cancel all and restore seats
  await prisma.$transaction([
    prisma.booking.updateMany({
      where: { id: { in: expired.map((b) => b.id) } },
      data: { status: 'Canceled' },
    }),
    ...expired.map((b) =>
      prisma.session.update({
        where: { id: b.sessionId },
        data: { seatsAvailable: { increment: 1 } },
      })
    ),
  ]);

  // Return list so n8n can send WhatsApp timeout messages to each guest
  return NextResponse.json({
    canceled: expired.map((b) => ({
      bookingId: b.id,
      phone: b.guestPhone,
      guestName: b.guestName,
    })),
  });
}
